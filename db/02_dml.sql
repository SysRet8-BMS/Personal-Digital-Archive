-- =====================================================================
-- Personal Digital Archive : DML  (each "-- ###" line starts a section)
-- Course/demo script only. Includes destructive and role-denial examples; do not run as app setup.
-- =====================================================================

-- ### D1. INSERT - file formats (lookup data)
INSERT INTO file_format (format_name, mime_type, is_text_extractable) VALUES
 ('Plain Text', 'text/plain',        TRUE),
 ('Markdown',   'text/markdown',     TRUE),
 ('PDF',        'application/pdf',   TRUE),
 ('Word',       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   TRUE),
 ('PowerPoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', TRUE),
 ('Excel',      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         TRUE),
 ('CSV',        'text/csv',          TRUE),
 ('HTML',       'text/html',         TRUE),
 ('PNG',        'image/png',         TRUE),
 ('JPEG',       'image/jpeg',        TRUE),
 ('Other',      'application/octet-stream', FALSE);

-- ### D2. INSERT - multivalued attribute: file extensions
INSERT INTO file_format_extension (format_id, extension) VALUES
 (1,'txt'), (2,'md'), (2,'markdown'), (3,'pdf'), (4,'docx'), (5,'pptx'), (6,'xlsx'),
 (7,'csv'), (8,'html'), (8,'htm'), (9,'png'), (10,'jpg'), (10,'jpeg');

-- ### D3. INSERT - nested collections (self-reference via parent_id)
INSERT INTO collection (name, parent_id) VALUES
 ('Academics',        NULL),   -- 1
 ('DBMS',             1),      -- 2
 ('Machine Learning', 1),      -- 3
 ('Personal',         NULL),   -- 4
 ('Travel',           4),      -- 5
 ('Finance',          4),      -- 6
 ('Goa 2025',         5),      -- 7
 ('Projects',         NULL);   -- 8

-- ### D4. INSERT - tags
INSERT INTO tag (name) VALUES
 ('notes'), ('important'), ('lecture'), ('receipt'), ('travel'), ('research'), ('todo');

-- ### D5. Ingest items through the stored procedure add_item (item + chunks in ONE transaction)
CALL add_item('DBMS Lecture 1 - ER Model', 'Introduction to entities, relationships and ER diagrams',
              'College LMS', '/archive/academics/dbms', 'lecture1_er_model.pdf', 'application/pdf',
              '2025-08-12 10:00+05:30',
              ARRAY['An entity is a real-world object that is distinguishable from other objects.',
                    'A weak entity has no primary key of its own and depends on an owner entity.',
                    'Relationships associate entities and may carry descriptive attributes.']);
CALL add_item('Normalization Notes', 'Functional dependencies, 3NF and BCNF',
              'Own notes', '/archive/academics/dbms', 'normalization.md', 'text/markdown',
              '2025-09-02 21:15+05:30',
              ARRAY['Normalization removes redundancy by decomposing relations using functional dependencies.',
                    'BCNF requires every determinant to be a candidate key.']);
CALL add_item('SQL Cheat Sheet', 'Joins, window functions, recursive CTEs',
              'Downloaded', '/archive/academics/dbms', 'sql_cheatsheet.docx',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              '2025-07-20 09:30+05:30',
              ARRAY['A recursive CTE repeatedly joins its own output to walk hierarchical data.']);
CALL add_item('Goa Beach Sunset', 'Photo from the Goa trip', 'Phone camera', '/archive/personal/travel',
              'goa_sunset.jpg', 'image/jpeg', '2025-05-14 18:40+05:30',
              ARRAY['Calangute Beach, Goa - sunset 14 May 2025']);
CALL add_item('Neural Networks Slides', 'Intro deck on neural networks', 'College LMS',
              '/archive/academics/ml', 'nn_intro.pptx',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              '2025-09-10 11:00+05:30',
              ARRAY['A neural network is a stack of layers that learn representations from data.',
                    'Backpropagation computes gradients of the loss with respect to every weight.']);
CALL add_item('Family Video', 'Birthday video', 'Phone camera', '/archive/personal/videos',
              'birthday.mkv', 'video/x-matroska', '2025-03-03 19:00+05:30', NULL);
CALL add_item('Old Draft', 'Draft waiting for text extraction', 'Own notes', '/archive/misc',
              'draft_old.txt', 'text/plain', NULL, NULL);

-- ### D6. INSERT - items added directly (with an explicit extraction method)
INSERT INTO item (title, description, source, file_dir, file_name, format_id, created_at,
                  extraction_status, extraction_method)
VALUES
 ('Electricity Bill Sep 2025', 'Scanned bill', 'Scanner', '/archive/personal/finance', 'bill_sep25.pdf',
  3, '2025-09-30 08:00+05:30', 'done', 'ocr'),
 ('Budget 2025', 'Monthly budget spreadsheet', 'Own file', '/archive/personal/finance', 'budget_2025.xlsx',
  6, '2025-01-05 12:00+05:30', 'done', 'text_layer'),
 ('Resume', NULL, 'Own file', '/archive/personal', 'resume.pdf', 3, '2025-06-01 09:00+05:30',
  'done', 'text_layer');

-- ### D7. INSERT - chunks for the directly inserted items
INSERT INTO chunk (item_id, seq_no, content) VALUES
 (8,  1, 'Electricity bill for September 2025. Amount due 1,240 rupees.'),
 (9,  1, 'Budget 2025: rent, groceries, travel, savings and utilities.'),
 (10, 1, 'Resume: Bhuvan M S, B.E. student, interests in databases and machine learning.');

-- ### D8. INSERT - M:N relationship rows (BELONGS_TO and TAGGED_WITH)
INSERT INTO item_collection (item_id, collection_id) VALUES
 (1,2), (2,2), (3,2), (2,3), (5,3), (4,7), (8,6), (9,6), (10,4), (7,8);
INSERT INTO item_tag (item_id, tag_id) VALUES
 (1,1), (1,3), (2,1), (2,3), (2,2), (3,1), (4,5), (5,3), (8,4), (8,2);

-- ### D9. INSERT - access log and search log (complex attribute stored across two tables)
INSERT INTO access_log (item_id, accessed_at) VALUES
 (1,'2025-10-01 09:00+05:30'), (1,'2025-10-01 20:10+05:30'), (1,'2025-10-02 08:45+05:30'),
 (1,'2025-10-02 21:00+05:30'), (2,'2025-09-30 18:00+05:30'), (2,'2025-10-02 19:30+05:30'),
 (2,'2025-10-03 07:15+05:30'), (8,'2025-10-02 12:00+05:30'), (8,'2025-10-03 09:20+05:30'),
 (4,'2025-09-28 22:00+05:30'), (3,'2025-10-01 16:40+05:30'), (5,'2025-09-29 14:25+05:30');
INSERT INTO search_log (query_text, search_type, filter_format_id, filter_date_from, filter_date_to, result_count)
VALUES ('normal form', 'keyword', 3, '2025-01-01', '2025-12-31', 2),
       ('how do networks learn', 'semantic', NULL, NULL, NULL, 5);
INSERT INTO search_log_tag (search_id, tag_id) VALUES (1,1), (1,3);

-- ### D10. UPDATE - mark favorite / archived (FR3)
UPDATE item SET is_favorite = TRUE WHERE item_id IN (1, 2);
UPDATE item SET is_archived = TRUE WHERE title = 'Family Video';
SELECT item_id, title, is_favorite, is_archived FROM item WHERE is_favorite OR is_archived ORDER BY item_id;

-- ### D11. UPDATE - edit an item; trigger item_set_updated_at refreshes updated_at (FR19)
SELECT item_id, title, updated_at FROM item WHERE item_id = 3;
UPDATE item SET title = 'SQL Cheat Sheet (Revised)', description = 'Joins, windows, CTEs and triggers' WHERE item_id = 3;
SELECT item_id, title, updated_at FROM item WHERE item_id = 3;

-- ### D12. UPDATE / INSERT - embedding worker finishes chunks (FR9, FR10)
INSERT INTO embedding (chunk_id, model_name, dimension, vec)
SELECT c.chunk_id, 'all-MiniLM-L6-v2', 384,
       (SELECT array_agg(random())::vector(384) FROM generate_series(1, 384) g WHERE c.chunk_id IS NOT NULL)
FROM chunk c WHERE c.item_id IN (1, 2);
UPDATE chunk SET embedding_status = 'done'   WHERE item_id IN (1, 2);
UPDATE chunk SET embedding_status = 'failed' WHERE item_id = 3;
SELECT embedding_status, count(*) AS chunks FROM chunk GROUP BY embedding_status ORDER BY 1;

-- ### Q1. SELECT - all items with their format (join)
SELECT i.item_id, i.title, ff.format_name, i.extraction_status, i.extraction_method
FROM item i JOIN file_format ff USING (format_id)
ORDER BY i.item_id;

-- ### Q2. SELECT - filter by format, tag, collection and date range (FR11)
SELECT i.item_id, i.title
FROM item i
JOIN item_tag it        ON it.item_id = i.item_id
JOIN tag t              ON t.tag_id = it.tag_id AND t.name = 'notes'
JOIN item_collection ic ON ic.item_id = i.item_id AND ic.collection_id = 2
WHERE i.format_id = 3
  AND i.created_at BETWEEN '2025-08-01' AND '2025-12-31';

-- ### Q3. Full-text search over title, description and extracted text (FR12)
SELECT DISTINCT i.item_id, i.title
FROM item i LEFT JOIN chunk c ON c.item_id = i.item_id
WHERE i.search_vector @@ websearch_to_tsquery('english', 'normalization')
   OR c.content_tsv   @@ websearch_to_tsquery('english', 'normalization')
ORDER BY i.item_id;

-- ### Q4. Function search_items(filters) with and without filters (FR20)
SELECT * FROM search_items('weak entity');
SELECT * FROM search_items('recursive', p_format_id => 4);
SELECT * FROM search_items(NULL, p_collection_id => 2);

-- ### Q5. Recursive CTE - list everything under folder 'Academics' and 'Personal' (FR7, FR17)
WITH RECURSIVE tree AS (
    SELECT collection_id, name, parent_id, 0 AS depth, name::text AS path
    FROM collection WHERE parent_id IS NULL
  UNION ALL
    SELECT c.collection_id, c.name, c.parent_id, t.depth + 1, t.path || ' / ' || c.name
    FROM collection c JOIN tree t ON c.parent_id = t.collection_id
)
SELECT repeat('    ', depth) || name AS folder, path FROM tree ORDER BY path;

-- ### Q6. Recursive CTE - all items under 'Personal' including subfolders
WITH RECURSIVE sub AS (
    SELECT collection_id FROM collection WHERE name = 'Personal'
  UNION ALL
    SELECT c.collection_id FROM collection c JOIN sub s ON c.parent_id = s.collection_id
)
SELECT DISTINCT i.item_id, i.title
FROM item i JOIN item_collection ic USING (item_id)
WHERE ic.collection_id IN (SELECT collection_id FROM sub)
ORDER BY i.item_id;

-- ### Q7. Most recently accessed items (aggregate + ORDER BY)
SELECT i.item_id, i.title, max(a.accessed_at) AS last_accessed
FROM item i JOIN access_log a USING (item_id)
GROUP BY i.item_id, i.title
ORDER BY last_accessed DESC LIMIT 5;

-- ### Q8. Top tags by usage with RANK() window function
SELECT t.name, count(it.item_id) AS usage_count,
       RANK() OVER (ORDER BY count(it.item_id) DESC) AS usage_rank
FROM tag t LEFT JOIN item_tag it USING (tag_id)
GROUP BY t.name
ORDER BY usage_rank, t.name;

-- ### Q9. Untagged items (NULL handling with LEFT JOIN)
SELECT i.item_id, i.title
FROM item i LEFT JOIN item_tag it USING (item_id)
WHERE it.tag_id IS NULL
ORDER BY i.item_id;

-- ### Q10. Items accessed more than average (subquery)
SELECT i.item_id, i.title, count(*) AS accesses
FROM item i JOIN access_log a USING (item_id)
GROUP BY i.item_id, i.title
HAVING count(*) > (SELECT avg(cnt) FROM (SELECT count(*) AS cnt FROM access_log GROUP BY item_id) s)
ORDER BY accesses DESC;

-- ### Q11. Items in collection A (DBMS) but not in B (Machine Learning) - set operation
SELECT i.item_id, i.title FROM item i JOIN item_collection ic USING (item_id)
WHERE ic.collection_id = (SELECT collection_id FROM collection WHERE name = 'DBMS')
EXCEPT
SELECT i.item_id, i.title FROM item i JOIN item_collection ic USING (item_id)
WHERE ic.collection_id = (SELECT collection_id FROM collection WHERE name = 'Machine Learning')
ORDER BY item_id;

-- ### Q12. Views (FR18)
SELECT * FROM item_summary ORDER BY item_id;
SELECT * FROM recent_items LIMIT 5;
SELECT * FROM stats_collection ORDER BY collection_id;
SELECT * FROM stats_tag ORDER BY usage_count DESC, name;
SELECT * FROM stats_format WHERE item_count > 0 ORDER BY item_count DESC, format_name;

-- ### Q13. Hybrid search: SQL filters + ranking by vector similarity (FR14)
SELECT c.chunk_id, c.item_id, i.title,
       e.vec <=> (SELECT vec FROM embedding WHERE chunk_id = 1) AS cosine_distance
FROM chunk c JOIN item i USING (item_id)
JOIN item_collection ic ON ic.item_id = i.item_id AND ic.collection_id = 2
JOIN embedding e ON e.chunk_id = c.chunk_id
WHERE c.embedding_status = 'done' AND i.is_archived = FALSE
ORDER BY cosine_distance
LIMIT 5;

-- ### T1. Transaction - atomic ingest: a failure rolls back the item AND its chunks (FR21)
BEGIN;
INSERT INTO item (title, file_dir, file_name, format_id) VALUES ('Half-ingested file', '/archive/tmp', 'half.txt', 1);
INSERT INTO chunk (item_id, seq_no, content) VALUES (currval('item_item_id_seq'), 0, 'bad chunk: seq_no 0 violates CHECK');
ROLLBACK;
SELECT count(*) AS leftover_items FROM item WHERE title = 'Half-ingested file';

-- ### T2. Concurrency - two workers claim pending chunks with FOR UPDATE SKIP LOCKED (FR22)
SELECT chunk_id, item_id, seq_no FROM chunk
WHERE embedding_status = 'pending' ORDER BY chunk_id
LIMIT 2 FOR UPDATE SKIP LOCKED;

-- ### X1. EXPLAIN - GIN index on chunk.content_tsv, before and after (NFR)
BEGIN;
INSERT INTO chunk (item_id, seq_no, content)
SELECT 7, g, 'filler paragraph number ' || g || ' about holidays, bills and photographs'
FROM generate_series(1, 20000) g;
UPDATE chunk SET content = 'normalization removes update anomalies' WHERE item_id = 7 AND seq_no = 777;
ANALYZE chunk;
DROP INDEX idx_chunk_content_tsv;
EXPLAIN ANALYZE SELECT chunk_id FROM chunk WHERE content_tsv @@ to_tsquery('english', 'normalization');
CREATE INDEX idx_chunk_content_tsv ON chunk USING GIN (content_tsv);
ANALYZE chunk;
EXPLAIN ANALYZE SELECT chunk_id FROM chunk WHERE content_tsv @@ to_tsquery('english', 'normalization');
ROLLBACK;

-- ### R1. RBAC - allowed and denied operations (Section 5)
SET ROLE archive_app;
SELECT count(*) AS items_visible_to_app FROM item;
SELECT * FROM audit_log;
RESET ROLE;
SET ROLE embedding_worker;
UPDATE chunk SET embedding_status = 'done' WHERE chunk_id = 1;
UPDATE chunk SET content = 'tampered' WHERE chunk_id = 1;
DELETE FROM chunk WHERE chunk_id = 1;
RESET ROLE;
SET ROLE report_reader;
SELECT * FROM stats_format WHERE item_count > 0 ORDER BY item_count DESC, format_name LIMIT 3;
SELECT * FROM item;
RESET ROLE;
UPDATE chunk SET embedding_status = 'done' WHERE chunk_id = 1;

-- ### D13. DELETE - remove an item: cascades to chunks / tags / collections, trigger writes audit_log (FR16)
SELECT item_id, title FROM item WHERE item_id = 1;
SELECT count(*) AS chunks_before FROM chunk WHERE item_id = 1;
SELECT count(*) AS embeddings_before FROM embedding e JOIN chunk c USING (chunk_id) WHERE c.item_id = 1;
DELETE FROM item WHERE item_id = 1;
SELECT count(*) AS chunks_after FROM chunk WHERE item_id = 1;
SELECT count(*) AS embeddings_after FROM embedding e WHERE e.chunk_id NOT IN (SELECT chunk_id FROM chunk);
SELECT count(*) AS tag_rows_after FROM item_tag WHERE item_id = 1;
SELECT audit_id, item_id, item_title, action, action_by, action_at FROM audit_log;

-- ### D14. DELETE - tag and a nested collection (cascades)
SELECT collection_id, name, parent_id FROM collection ORDER BY collection_id;
SELECT item_id, collection_id FROM item_collection WHERE item_id = 4;
DELETE FROM tag WHERE name = 'todo';
DELETE FROM collection WHERE name = 'Travel';
SELECT collection_id, name, parent_id FROM collection ORDER BY collection_id;
SELECT item_id, collection_id FROM item_collection WHERE item_id = 4;
