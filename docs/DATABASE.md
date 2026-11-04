# Database Design Record

PostgreSQL with pgvector is the archive's source of truth. Metadata, extracted text, statuses, activity, audit history, and 384-dimensional vectors remain in the same database. This follows the current SQL schema and avoids a separately operated vector service.

## Schema lifecycle

- `db/01_ddl.sql`: complete canonical schema for an empty database. It contains destructive drops and must not be run against an existing archive.
- `db/seed.sql`: safe, idempotent file-format and extension lookup rows used by local setup.
- `db/02_dml.sql`: course demonstration statements, including destructive test actions; not a setup seed.
- `db/migrations/*.sql`: ordered additive changes tracked in `schema_migrations`.
- When schema changes land, update the canonical DDL and add the migration that upgrades databases already initialized from the prior snapshot.

Development PostgreSQL data is bind-mounted to the host. Archive file bytes stay on the host filesystem outside the DB container. Production database deployment has not been selected.

## Current schema change

The collection hierarchy now has a database trigger that rejects moves creating ancestor cycles. The API also checks references and maps the database constraint to a conflict response. The same trigger appears in the canonical snapshot and migration `0001_prevent_collection_cycles.sql`.
