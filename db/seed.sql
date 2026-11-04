INSERT INTO file_format (format_name, mime_type, is_text_extractable) VALUES
 ('Plain Text', 'text/plain', TRUE),
 ('Markdown', 'text/markdown', TRUE),
 ('PDF', 'application/pdf', TRUE),
 ('Word', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', TRUE),
 ('PowerPoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', TRUE),
 ('Excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', TRUE),
 ('CSV', 'text/csv', TRUE),
 ('HTML', 'text/html', TRUE),
 ('PNG', 'image/png', TRUE),
 ('JPEG', 'image/jpeg', TRUE),
 ('Other', 'application/octet-stream', FALSE)
ON CONFLICT (mime_type) DO NOTHING;

INSERT INTO file_format_extension (format_id, extension)
SELECT f.format_id, v.extension
FROM (VALUES
  ('text/plain', 'txt'), ('text/markdown', 'md'), ('text/markdown', 'markdown'),
  ('application/pdf', 'pdf'), ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'),
  ('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'),
  ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'),
  ('text/csv', 'csv'), ('text/html', 'html'), ('text/html', 'htm'), ('image/png', 'png'),
  ('image/jpeg', 'jpg'), ('image/jpeg', 'jpeg')
) AS v(mime_type, extension)
JOIN file_format f USING (mime_type)
ON CONFLICT (extension) DO NOTHING;
