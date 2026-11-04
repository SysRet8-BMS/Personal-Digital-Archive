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
