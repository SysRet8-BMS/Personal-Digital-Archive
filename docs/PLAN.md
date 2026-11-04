# Implementation Plan

## Goal

Build the SRS Personal Digital Archive as a local, single-user Next.js application. PostgreSQL remains the source of truth; files remain on disk. The SQL scripts define the authoritative schema and database behavior.

## Requirements to preserve

- Item metadata, file location, favorites and archive state; nested collections and free-form tags.
- Text extraction and OCR for the supported formats, chunk storage, and extraction/embedding statuses.
- Filter, keyword, semantic, and hybrid search; access and search history; reports and statistics.
- Atomic item-and-chunk ingest, post-commit embedding work, safe worker claiming, and delete auditing.
- No application login, sharing, synchronization, cloud deployment, or multi-user features.

## Proposed implementation sequence

### 1. Repository and runtime foundation

- Establish a platform-agnostic Next.js application with separate server-side data, domain, and UI concerns; keep database credentials and filesystem operations on the server.
- Use Docker Compose for development PostgreSQL with pgvector. Persist database data in a host directory. Keep archived binaries on the host filesystem, outside the database container.
- Default the selected index root to the user's existing Downloads directory. Let configuration change it to Documents or another path within the user's profile, including the profile directory itself.
- Add concise setup and configuration guidance to `README.md` as the working application becomes available.
- Document significant database and backend decisions in `docs/`; keep frontend and backend guidance separate as they grow.

### 2. Database integration

- Connect to PostgreSQL and use the existing schema, constraints, views, procedure, function, and indexes as the contract.
- Use parameterized queries and transactions. Call `add_item` for atomic metadata-and-chunk ingest and `search_items` for keyword/filter search where its behavior matches the requested operation.
- Add only migrations or SQL changes needed to bridge an identified application requirement to the existing schema; document any proposed divergence before applying it.
- Keep role boundaries in view: the web application uses `archive_app`; embedding work uses the narrowly scoped worker role. Do not add application-level authentication.

### 3. Backend capabilities

- Implement server-side services and Next.js API endpoints for:
  - Item listing/detail, ingest, editing, favorite/archive changes, and deletion.
  - Collection tree and membership management; tag listing and item tagging.
  - Filter and full-text search, semantic search, and hybrid search.
  - Recent access, search history, and the report/statistics queries specified by FR17 and FR18.
- Index only files located under the selected root. On ingest, files already inside that root are referenced in place. If importing a file from outside it, copy it under the selected root and ask whether to delete the original; default the answer to no. Extract text for supported types, split it into chunks, and commit item plus chunks together. Store metadata only for unsupported formats.
- Run embedding generation after the ingest transaction commits. Claim pending chunks with `FOR UPDATE SKIP LOCKED`, persist the vector/model/dimension and update chunk status. Leave work pending after transient failure and mark terminal failures as failed.
- Record access and search activity. Rely on the database trigger for delete audit and updated timestamps.
- Serve files through controlled server routes rather than exposing arbitrary filesystem paths.

### 4. Frontend capabilities

- Provide pages for browsing items, item details, adding/editing items, search/filtering, and viewing collections and tags (FR23).
- Surface extraction and embedding status, favorite/archive controls, and useful metadata without exposing database implementation details.
- Provide navigation to recent items, search history, and the requested reports/statistics.
- Connect UI actions only to the backend capabilities already implemented; handle empty, loading, and error states.
- Keep the application offline-only: no hosted services, telemetry, CDNs, remote fonts, model downloads, or runtime network requests. Bundle required code and extraction assets locally.

### 5. Integration and documentation

- Complete the end-to-end flows in dependency order: browse existing records, detail/access logging, organization, ingest/extraction, keyword/filter search, embeddings and semantic/hybrid search, reports, then deletion/audit.
- Update `README.md` with a high-level overview and local setup instructions as implementation proceeds. Put database schema/decision records and separate backend/frontend notes under `docs/`.
- Maintain `AGENTS.md` with repository context, setup and workflow know-how, SQL caveats, and relevant constraints for a new contributor.

## Requirement traceability

| Area | SRS requirements | SQL source of truth |
| --- | --- | --- |
| Items and organization | FR1–FR3, FR7–FR8 | `item`, `collection`, `item_collection`, `tag`, `item_tag` |
| Extraction and embeddings | FR4–FR6, FR9–FR10 | `item`, `chunk`, `embedding` |
| Search | FR11–FR14 | `search_items`, generated search vectors, `embedding.vec` |
| Activity and audit | FR15–FR16 | `access_log`, `search_log`, `search_log_tag`, delete trigger |
| Reports and database behavior | FR17–FR22 | recursive relationships, views, trigger, procedure, function, role grants |
| UI | FR23 | Next.js pages backed by the endpoints above |

## Confirmed design choices

- Use pgvector in PostgreSQL; do not add a standalone vector database. Production database hosting remains undecided.
- Index only within the selected root. Default to an existing Downloads folder; allow Documents or another existing directory within the user's home/profile, including the profile itself. Windows home is the user profile directory, not `C:\`.
- Keep file binaries on the host disk during development. Files already under the selected root stay in place; imports from outside are copied into the root and the user is asked before deleting the original (default no).
- Use local Next.js-compatible extraction tools. The design recommends PDF.js, Tesseract.js, and local format parsers, with all OCR assets bundled before offline use.
- Bind the application and development database to loopback. Do not use hosted services, telemetry, CDNs, or runtime external requests.

## First implementation checkpoint

Implement the local runtime/database foundation and the first logical backend group: item list/detail/update, collection list/create/update/delete, and tag list/create. Stop after these nine API operations and their Postman collections. Leave ingest, search, activity, reports, scans, and UI pages for the next contributor.

## Checkpoint status

The plan and design have been approved. The first backend checkpoint implements item list/detail/update, collection list/create/update/delete, and tag list/create, with Postman Basic and Exhaustive collections. Stop after this checkpoint so the next contributor can take the remaining APIs and UI.
