# Backend Notes

Next.js route handlers use parameterized PostgreSQL queries. A local PostgreSQL 18 pgvector container is provided for development; production hosting is undecided. The database has no app-level authentication.

## Implemented baseline

- `GET /api/items`: paged listing and metadata filters.
- `GET /api/items/{id}`: item, chunks, memberships, plus access log append.
- `PATCH /api/items/{id}`: metadata and full replacement of collection/tag membership arrays in one transaction.
- `GET|POST /api/collections`, `PATCH|DELETE /api/collections/{id}`.
- `GET|POST /api/tags`.
- `DELETE /api/tags/{id}`.
- `POST /api/items`, `DELETE /api/items/{id}`, and `GET /api/items/{id}/file`.
- `POST /api/search` for filter, keyword, semantic, and hybrid queries.
- `GET /api/activity/recent`, `GET /api/activity/searches`, report endpoints, and `GET /api/settings`.
- `POST /api/scan` and scan status reads for explicit selected-root indexing.

All API errors use `{error:{code,message}}`. Check the local Postman collections for request examples. The Exhaustive collection uses a local fixture and must be run with `ARCHIVE_ROOT` set to a disposable directory because it exercises root scanning. `GET /api/items?q` is a title substring filter; full-text and vector search use `POST /api/search`.

## Database lifecycle

- Fresh setup: `npm run db:setup` applies canonical DDL and the lookup seed once, then ordered migrations. It does not create fake items.
- Existing schema updates: `npm run db:migrate` applies unapplied SQL migration files transactionally and records them in `schema_migrations`.
- Canonical files: `db/01_ddl.sql` (schema), `db/02_dml.sql` (course demonstration statements), and `db/seed.sql` (safe format lookup seed). `02_dml.sql` includes destructive demo statements and must not be run as setup. New schema changes should be reflected in both migration history and the canonical DDL snapshot.

## Full SRS scope

The full SRS API surface is implemented. Ingest uses `add_item` in the encompassing transaction and adds memberships there. The local embedding worker claims pending chunks with `FOR UPDATE SKIP LOCKED`. Run both Postman collections against PostgreSQL before final commits and resolve any outstanding issues.
