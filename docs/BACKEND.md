# Backend Notes

Next.js route handlers use parameterized PostgreSQL queries. A local PostgreSQL 18 pgvector container is provided for development; production hosting is undecided. The database has no app-level authentication.

## First checkpoint

- `GET /api/items`: paged listing and metadata filters.
- `GET /api/items/{id}`: item, chunks, memberships, plus access log append.
- `PATCH /api/items/{id}`: metadata and full replacement of collection/tag membership arrays in one transaction.
- `GET|POST /api/collections`, `PATCH|DELETE /api/collections/{id}`.
- `GET|POST /api/tags`.

All API errors use `{error:{code,message}}`. Check the local Postman collections for request examples. The clean setup has no placeholder archive items; the item-specific Postman requests skip unless a real item exists or `itemId` is set in the collection variables. Do not use `GET /api/items?q` as final full-text search; currently it performs title substring matching only.

## Database lifecycle

- Fresh setup: `npm run db:setup` applies canonical DDL and the lookup seed once, then ordered migrations. It does not create fake items.
- Existing schema updates: `npm run db:migrate` applies unapplied SQL migration files transactionally and records them in `schema_migrations`.
- Canonical files: `db/01_ddl.sql` (schema), `db/02_dml.sql` (course demonstration statements), and `db/seed.sql` (safe format lookup seed). `02_dml.sql` includes destructive demo statements and must not be run as setup. New schema changes should be reflected in both migration history and the canonical DDL snapshot.

## Next work

Add upload/import with root containment, local extraction, atomic `add_item` and memberships, worker lifecycle/embeddings, keyword/semantic/hybrid search, activity endpoints, reports, and local file serving. Add Postman cases alongside each API group.
