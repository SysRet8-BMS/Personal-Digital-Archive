# Repository Context for Contributors

## Purpose and constraints

- Local-only, single-user personal archive. No application login, cloud services, telemetry, or external runtime requests.
- Next.js server routes own PostgreSQL access and local filesystem access. Keep secrets and path handling server-side.
- PostgreSQL is the source of truth. pgvector is enabled in the database; there is no separate vector store.
- Read `SRS_Personal_Digital_Archive.pdf`, `Personal_Digital_Archive_Report.pdf`, and `CODEX.md` for requirements and workflow. The SQL snapshots are authoritative for database behavior.

## General guidelines:

1) code is free of excessive comments (one/two liners at most, in important places)
2) commits are made at a certain checkpoint; use conventional commits with one-liner messages
3) update the README as the implementation proceeds; README is high level overview with the setup, while major ADRs and SDRs(for DBs) live in docs/ directory, maintain separate docs for frontend and backend
4) documents shouldn't be too verbose. prefer mermaid diagrams to explain different flows.
5) follow simple formatting in docs. make sure no implementation level details are revealed in the README (including the repo structure)
6) don't make any assumptions. feel free to clarify with me.
7) do not register any commits as any AGENT(claude, gpt codex etc..)
8) do not deviate from the SRS unless specified by me. try to stick to a minimal but a clean implementation on both frontend and backend.

## Markdown and commit policy

- `docs/PLAN.md` and `docs/DESIGN.md` are approved reference documents. Keep them in `docs/` and do not edit them further unless the user explicitly asks.
- Commit only `README.md`, `AGENTS.md`, `docs/PLAN.md`, and `docs/DESIGN.md` from the Markdown files. Keep every other Markdown file untracked; this includes `CODEX.md`, `MY_NOTES.md`, and other Markdown notes under `docs/`.
- Before committing, stage paths explicitly. Do not use a blanket `git add -A` because repository guidance and reference files must remain untracked.

## Local setup

- Node.js 20.9+, Docker Compose, and PostgreSQL 18 pgvector development image.
- Copy `.env.example` to `.env`, start `docker compose up -d`, install dependencies, run `npm run db:setup`, then `npm run dev`.
- `db/01_ddl.sql` is the canonical fresh-database schema snapshot; `db/02_dml.sql` is the course demonstration script and includes destructive sample operations, so do not execute it as setup. `db/seed.sql` inserts the supported format lookup rows. Ordered additive changes live in `db/migrations/`; use `npm run db:migrate` after setup.
- Keep PostgreSQL data in `.data/postgres` on the host. Archive binaries remain on the host and are never mounted into the DB container.

## Important repository caveats

- Default selected root: existing `Downloads` within `os.homedir()`. Users may select Documents or any existing path within their profile/home. Windows home is usually the user profile, not `C:\`.
- Never index outside the selected root. Resolve real paths to block traversal and symlink escapes. Files already inside are referenced in place. Importing from outside copies into the root and asks before deleting the original; default is no.
- Do not perform a home-wide scan by default. No watcher/background crawl until explicitly designed.
- The SQL `collection` table uses cascading parent deletion, so deleting a collection also removes nested collections and their memberships. API updates must reject hierarchy cycles; the DB trigger also enforces this.
- `item_summary` and `search_items` have the behavior in the DDL; `search_items` is keyword/filter only. Semantic search is a separate future pgvector query.
- `add_item` does not accept collection/tag relationships. Preserve atomic ingest by adding them inside the same encompassing transaction or revising the procedure.
- Keep the DDL and migration history aligned. Canonical snapshots are not migrations and include destructive table drops, so run them only on an empty fresh database.
- Do not use cloud OCR, remote model APIs, CDNs, hosted fonts, or telemetry. Bundle any future extraction workers, OCR engines, language files, and model assets locally.

## Current implementation boundary

Implemented backend checkpoint: item list/detail/PATCH, collection GET/POST/PATCH/DELETE, tag GET/POST. Postman `Basic` covers happy paths; `Exhaustive` covers common validation, conflict, missing record, cycle, and cascade cases. Do not infer that ingest/search/UI work is already present.
