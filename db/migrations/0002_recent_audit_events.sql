CREATE OR REPLACE VIEW recent_audit_events AS
SELECT audit_id, item_id, item_title, action, action_at
FROM audit_log
ORDER BY action_at DESC
LIMIT 100;

GRANT SELECT ON recent_audit_events TO archive_app;
