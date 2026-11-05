-- =====================================================================
-- Personal Digital Archive : canonical DDL snapshot (PostgreSQL 18 + pgvector)
-- Fresh database only: the DROP TABLE block below is destructive.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS search_log_tag, search_log, audit_log, access_log,
                     embedding, chunk, item_tag, item_collection, item,
                     tag, collection, file_format_extension, file_format CASCADE;

-- ---------------------------------------------------------------------
-- 1. FILE_FORMAT (lookup) and its multivalued attribute "extension"
-- ---------------------------------------------------------------------
CREATE TABLE file_format (
    format_id        SERIAL        PRIMARY KEY,
    format_name      VARCHAR(50)   NOT NULL,
    mime_type        VARCHAR(100)  NOT NULL UNIQUE,
    is_text_extractable BOOLEAN    NOT NULL DEFAULT TRUE   -- FALSE => metadata only
);

CREATE TABLE file_format_extension (          -- multivalued attribute
    format_id   INT          NOT NULL REFERENCES file_format(format_id) ON DELETE CASCADE,
    extension   VARCHAR(10)  NOT NULL,
    PRIMARY KEY (format_id, extension),
    CONSTRAINT uq_extension UNIQUE (extension)
);

-- ---------------------------------------------------------------------
-- 2. COLLECTION (self-referencing, nestable folders)
-- ---------------------------------------------------------------------
CREATE TABLE collection (
    collection_id  SERIAL        PRIMARY KEY,
    name           VARCHAR(100)  NOT NULL,
    parent_id      INT           REFERENCES collection(collection_id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_collection_not_own_parent CHECK (parent_id IS NULL OR parent_id <> collection_id)
);
-- sibling folders must have distinct names (NULL parent = root level)
CREATE UNIQUE INDEX uq_collection_sibling_name
    ON collection (COALESCE(parent_id, 0), lower(name));

-- Prevent a collection from becoming its own ancestor.
CREATE OR REPLACE FUNCTION prevent_collection_cycle() RETURNS trigger AS $$
DECLARE
    v_cycle BOOLEAN;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    WITH RECURSIVE ancestors AS (
        SELECT collection_id, parent_id FROM collection WHERE collection_id = NEW.parent_id
        UNION
        SELECT c.collection_id, c.parent_id
        FROM collection c JOIN ancestors a ON c.collection_id = a.parent_id
    )
    SELECT EXISTS (
        SELECT 1 FROM ancestors WHERE collection_id = NEW.collection_id
    ) INTO v_cycle;

    IF v_cycle THEN
        RAISE EXCEPTION 'collection parent would create a cycle' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER collection_prevent_cycle
    BEFORE INSERT OR UPDATE OF parent_id ON collection
    FOR EACH ROW EXECUTE FUNCTION prevent_collection_cycle();

-- ---------------------------------------------------------------------
-- 3. TAG
-- ---------------------------------------------------------------------
CREATE TABLE tag (
    tag_id  SERIAL       PRIMARY KEY,
    name    VARCHAR(50)  NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- 4. ITEM
--    file_path is a COMPOSITE attribute (file_dir, file_name)
-- ---------------------------------------------------------------------
CREATE TABLE item (
    item_id            SERIAL        PRIMARY KEY,
    title              VARCHAR(255)  NOT NULL,
    description        TEXT,
    source             VARCHAR(255),
    file_dir           VARCHAR(500)  NOT NULL,
    file_name          VARCHAR(255)  NOT NULL,
    format_id          INT           NOT NULL REFERENCES file_format(format_id),
    created_at         TIMESTAMPTZ,                              -- when the file was created
    added_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),     -- when it entered the archive
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),     -- maintained by trigger
    is_favorite        BOOLEAN       NOT NULL DEFAULT FALSE,
    is_archived        BOOLEAN       NOT NULL DEFAULT FALSE,
    extraction_status  VARCHAR(12)   NOT NULL DEFAULT 'pending',
    extraction_method  VARCHAR(10),
    search_vector      TSVECTOR GENERATED ALWAYS AS (
                          setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
                          setweight(to_tsvector('english', coalesce(description,'')), 'B')
                       ) STORED,
    CONSTRAINT uq_item_path UNIQUE (file_dir, file_name),
    CONSTRAINT ck_item_extraction_status
        CHECK (extraction_status IN ('pending','done','failed','unsupported')),
    CONSTRAINT ck_item_extraction_method
        CHECK (extraction_method IS NULL OR extraction_method IN ('text_layer','ocr')),
    CONSTRAINT ck_item_dates CHECK (created_at IS NULL OR created_at <= added_at + interval '1 day')
);

-- ---------------------------------------------------------------------
-- 5. M:N relationships with descriptive attributes
-- ---------------------------------------------------------------------
CREATE TABLE item_collection (               -- BELONGS_TO
    item_id        INT          NOT NULL REFERENCES item(item_id)             ON DELETE CASCADE,
    collection_id  INT          NOT NULL REFERENCES collection(collection_id) ON DELETE CASCADE,
    added_on       TIMESTAMPTZ  NOT NULL DEFAULT now(),      -- descriptive attribute
    PRIMARY KEY (item_id, collection_id)
);

CREATE TABLE item_tag (                      -- TAGGED_WITH
    item_id    INT          NOT NULL REFERENCES item(item_id) ON DELETE CASCADE,
    tag_id     INT          NOT NULL REFERENCES tag(tag_id)   ON DELETE CASCADE,
    tagged_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),          -- descriptive attribute
    PRIMARY KEY (item_id, tag_id)
);

-- ---------------------------------------------------------------------
-- 6. CHUNK : weak entity of ITEM (partial key = seq_no)
--    chunk_id is a surrogate candidate key that links a chunk to its vector
-- ---------------------------------------------------------------------
CREATE TABLE chunk (
    chunk_id          BIGSERIAL    PRIMARY KEY,
    item_id           INT          NOT NULL REFERENCES item(item_id) ON DELETE CASCADE,
    seq_no            INT          NOT NULL,
    content           TEXT         NOT NULL,
    embedding_status  VARCHAR(10)  NOT NULL DEFAULT 'pending',
    content_tsv       TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    CONSTRAINT uq_chunk_item_seq UNIQUE (item_id, seq_no),
    CONSTRAINT ck_chunk_seq CHECK (seq_no >= 1),
    CONSTRAINT ck_chunk_embedding_status CHECK (embedding_status IN ('pending','done','failed'))
);

-- ---------------------------------------------------------------------
-- 7. EMBEDDING : weak entity of CHUNK (1:1); the vector itself is stored
--    in the pgvector column vec
-- ---------------------------------------------------------------------
CREATE TABLE embedding (
    chunk_id     BIGINT        PRIMARY KEY REFERENCES chunk(chunk_id) ON DELETE CASCADE,
    model_name   VARCHAR(100)  NOT NULL,
    dimension    INT           NOT NULL CHECK (dimension > 0),
    embedded_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    vec          vector(384)   NOT NULL,
    CONSTRAINT ck_embedding_dim CHECK (vector_dims(vec) = dimension)
);

-- ---------------------------------------------------------------------
-- 8. LOG ENTITIES
-- ---------------------------------------------------------------------
CREATE TABLE access_log (
    log_id       BIGSERIAL    PRIMARY KEY,
    item_id      INT          NOT NULL REFERENCES item(item_id) ON DELETE CASCADE,
    accessed_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- SEARCH_LOG.filters is a COMPLEX attribute:
--   filters( format, collection, date_range(from,to), {tags} )
CREATE TABLE search_log (
    search_id             BIGSERIAL    PRIMARY KEY,
    query_text            TEXT,
    search_type           VARCHAR(10)  NOT NULL,
    filter_format_id      INT          REFERENCES file_format(format_id)       ON DELETE SET NULL,
    filter_collection_id  INT          REFERENCES collection(collection_id)    ON DELETE SET NULL,
    filter_date_from      DATE,
    filter_date_to        DATE,
    result_count          INT          CHECK (result_count >= 0),
    searched_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_search_type CHECK (search_type IN ('filter','keyword','semantic','hybrid')),
    CONSTRAINT ck_search_dates CHECK (filter_date_from IS NULL OR filter_date_to IS NULL
                                      OR filter_date_from <= filter_date_to)
);

CREATE TABLE search_log_tag (                -- multivalued part of the complex attribute
    search_id  BIGINT  NOT NULL REFERENCES search_log(search_id) ON DELETE CASCADE,
    tag_id     INT     NOT NULL REFERENCES tag(tag_id)           ON DELETE CASCADE,
    PRIMARY KEY (search_id, tag_id)
);

-- item_id is deliberately NOT a foreign key: the row must outlive the deleted item
CREATE TABLE audit_log (
    audit_id    BIGSERIAL     PRIMARY KEY,
    item_id     INT           NOT NULL,
    item_title  VARCHAR(255),
    action      VARCHAR(10)   NOT NULL,
    action_by   NAME          NOT NULL DEFAULT current_user,
    action_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_audit_action CHECK (action IN ('DELETE'))
);

CREATE OR REPLACE VIEW recent_audit_events AS
SELECT audit_id, item_id, item_title, action, action_at
FROM audit_log
ORDER BY action_at DESC
LIMIT 100;

-- ---------------------------------------------------------------------
-- 9. INDEXES
-- ---------------------------------------------------------------------
CREATE INDEX idx_item_format        ON item (format_id);
CREATE INDEX idx_item_added_at      ON item (added_at DESC);
CREATE INDEX idx_item_search_vector ON item USING GIN (search_vector);
CREATE INDEX idx_chunk_content_tsv  ON chunk USING GIN (content_tsv);
CREATE INDEX idx_chunk_pending      ON chunk (chunk_id) WHERE embedding_status = 'pending';
CREATE INDEX idx_embedding_vec      ON embedding USING hnsw (vec vector_cosine_ops);
CREATE INDEX idx_collection_parent  ON collection (parent_id);
CREATE INDEX idx_item_tag_tag       ON item_tag (tag_id);
CREATE INDEX idx_item_coll_coll     ON item_collection (collection_id);
CREATE INDEX idx_access_log_item    ON access_log (item_id, accessed_at DESC);

-- ---------------------------------------------------------------------
-- 10. TRIGGERS (FR19, FR16)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER item_set_updated_at
    BEFORE UPDATE ON item
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE OR REPLACE FUNCTION trg_audit_item_delete() RETURNS trigger AS $$
BEGIN
    INSERT INTO audit_log (item_id, item_title, action)
    VALUES (OLD.item_id, OLD.title, 'DELETE');
    RETURN OLD;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER item_audit_delete
    AFTER DELETE ON item
    FOR EACH ROW EXECUTE FUNCTION trg_audit_item_delete();

-- ---------------------------------------------------------------------
-- 11. VIEWS (FR18) - these also materialise the DERIVED attributes
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW item_summary AS
SELECT i.item_id, i.title, ff.format_name, i.extraction_status,
       i.is_favorite, i.is_archived, i.added_at,
       (SELECT count(*) FROM chunk c WHERE c.item_id = i.item_id)           AS chunk_count,   -- derived
       (SELECT count(*) FROM item_tag it WHERE it.item_id = i.item_id)      AS tag_count,     -- derived
       (SELECT count(*) FROM access_log a WHERE a.item_id = i.item_id)      AS access_count   -- derived
FROM item i JOIN file_format ff USING (format_id);

CREATE OR REPLACE VIEW recent_items AS
SELECT i.item_id, i.title, max(a.accessed_at) AS last_accessed
FROM item i JOIN access_log a USING (item_id)
GROUP BY i.item_id, i.title
ORDER BY last_accessed DESC
LIMIT 20;

CREATE OR REPLACE VIEW stats_collection AS
SELECT c.collection_id, c.name, count(ic.item_id) AS item_count          -- derived
FROM collection c LEFT JOIN item_collection ic USING (collection_id)
GROUP BY c.collection_id, c.name;

CREATE OR REPLACE VIEW stats_tag AS
SELECT t.tag_id, t.name, count(it.item_id) AS usage_count                 -- derived
FROM tag t LEFT JOIN item_tag it USING (tag_id)
GROUP BY t.tag_id, t.name;

CREATE OR REPLACE VIEW stats_format AS
SELECT ff.format_id, ff.format_name, count(i.item_id) AS item_count
FROM file_format ff LEFT JOIN item i USING (format_id)
GROUP BY ff.format_id, ff.format_name;

-- ---------------------------------------------------------------------
-- 12. STORED PROCEDURE add_item and FUNCTION search_items (FR20, FR21)
-- ---------------------------------------------------------------------
-- Atomic ingest: item + chunks in one transaction. The vector write
-- happens AFTER commit, so chunks start as 'pending'.
CREATE OR REPLACE PROCEDURE add_item(
    p_title        VARCHAR,
    p_description  TEXT,
    p_source       VARCHAR,
    p_file_dir     VARCHAR,
    p_file_name    VARCHAR,
    p_mime_type    VARCHAR,
    p_created_at   TIMESTAMPTZ,
    p_chunks       TEXT[],
    INOUT o_item_id INT DEFAULT NULL
) LANGUAGE plpgsql AS $$
DECLARE
    v_format_id INT;
    v_status    VARCHAR(12);
    v_method    VARCHAR(10);
    v_extract   BOOLEAN;
    i           INT;
BEGIN
    SELECT format_id, is_text_extractable INTO v_format_id, v_extract
    FROM file_format WHERE mime_type = p_mime_type;
    IF NOT FOUND THEN                                   -- unknown type => 'other' (metadata only)
        SELECT format_id, is_text_extractable INTO v_format_id, v_extract
        FROM file_format WHERE mime_type = 'application/octet-stream';
    END IF;

    IF NOT v_extract THEN
        v_status := 'unsupported'; v_method := NULL;
    ELSIF p_chunks IS NULL OR array_length(p_chunks,1) IS NULL THEN
        v_status := 'pending';     v_method := NULL;
    ELSE
        v_status := 'done';
        v_method := CASE WHEN p_mime_type LIKE 'image/%' THEN 'ocr' ELSE 'text_layer' END;
    END IF;

    INSERT INTO item (title, description, source, file_dir, file_name,
                      format_id, created_at, extraction_status, extraction_method)
    VALUES (p_title, p_description, p_source, p_file_dir, p_file_name,
            v_format_id, p_created_at, v_status, v_method)
    RETURNING item_id INTO o_item_id;

    IF p_chunks IS NOT NULL THEN
        FOR i IN 1 .. coalesce(array_length(p_chunks,1),0) LOOP
            INSERT INTO chunk (item_id, seq_no, content) VALUES (o_item_id, i, p_chunks[i]);
        END LOOP;
    END IF;
END $$;

-- Hybrid-capable keyword search with optional filters; NULL = "no filter"
CREATE OR REPLACE FUNCTION search_items(
    p_query          TEXT        DEFAULT NULL,
    p_format_id      INT         DEFAULT NULL,
    p_tag_id         INT         DEFAULT NULL,
    p_collection_id  INT         DEFAULT NULL,
    p_date_from      DATE        DEFAULT NULL,
    p_date_to        DATE        DEFAULT NULL
) RETURNS TABLE (item_id INT, title VARCHAR, rank REAL) AS $$
    SELECT i.item_id, i.title,
           CASE WHEN p_query IS NULL THEN 0
                ELSE greatest(
                       ts_rank(i.search_vector, websearch_to_tsquery('english', p_query)),
                       coalesce((SELECT max(ts_rank(c.content_tsv, websearch_to_tsquery('english', p_query)))
                                 FROM chunk c WHERE c.item_id = i.item_id), 0)
                     )
           END::REAL AS rank
    FROM item i
    WHERE (p_format_id IS NULL OR i.format_id = p_format_id)
      AND (p_tag_id IS NULL OR EXISTS (SELECT 1 FROM item_tag t
                                       WHERE t.item_id = i.item_id AND t.tag_id = p_tag_id))
      AND (p_collection_id IS NULL OR EXISTS (SELECT 1 FROM item_collection ic
                                       WHERE ic.item_id = i.item_id AND ic.collection_id = p_collection_id))
      AND (p_date_from IS NULL OR i.added_at::date >= p_date_from)
      AND (p_date_to   IS NULL OR i.added_at::date <= p_date_to)
      AND (p_query IS NULL
           OR i.search_vector @@ websearch_to_tsquery('english', p_query)
           OR EXISTS (SELECT 1 FROM chunk c
                      WHERE c.item_id = i.item_id
                        AND c.content_tsv @@ websearch_to_tsquery('english', p_query)))
    ORDER BY 3 DESC, 1;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------
-- 13. RBAC (Section 5)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='archive_app')       THEN CREATE ROLE archive_app; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='embedding_worker')  THEN CREATE ROLE embedding_worker; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='report_reader')     THEN CREATE ROLE report_reader; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='archive_admin')     THEN CREATE ROLE archive_admin; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO archive_app, embedding_worker, report_reader, archive_admin;

-- archive_admin : full control, can read audit_log
GRANT ALL ON ALL TABLES    IN SCHEMA public TO archive_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO archive_admin;

-- archive_app : DML on core tables, EXECUTE on add_item / search_items (no audit_log access)
GRANT SELECT, INSERT, UPDATE, DELETE ON
    file_format, file_format_extension, collection, tag, item, item_collection, item_tag,
    chunk, embedding, access_log, search_log, search_log_tag TO archive_app;
GRANT SELECT ON item_summary, recent_items, stats_collection, stats_tag, stats_format TO archive_app;
GRANT SELECT ON recent_audit_events TO archive_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO archive_app;
GRANT EXECUTE ON PROCEDURE add_item(VARCHAR,TEXT,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TIMESTAMPTZ,TEXT[],INT) TO archive_app;
GRANT EXECUTE ON FUNCTION  search_items(TEXT,INT,INT,INT,DATE,DATE) TO archive_app;

-- embedding_worker : read chunks, update ONLY embedding_status, write vectors to embedding
GRANT SELECT ON chunk TO embedding_worker;
GRANT UPDATE (embedding_status) ON chunk TO embedding_worker;
GRANT INSERT ON embedding TO embedding_worker;

-- report_reader : statistics views only
GRANT SELECT ON stats_collection, stats_tag, stats_format TO report_reader;
