# Personal Digital Archive

A local, single-user archive for organizing and finding personal files. PostgreSQL stores metadata, extracted text, activity, and pgvector embeddings; files remain on the computer's disk. The application is designed to work offline after its dependencies and local OCR assets are installed.

## Development setup

Requirements: Node.js 20.9 or newer, Docker with Compose, and a local existing `Downloads` folder (or another chosen directory within your home/profile).

1. Copy `.env.example` to `.env` and set a private local database password if desired.
2. Start PostgreSQL with `docker compose up -d`.
3. Install the JavaScript dependencies, then initialize the local database with `npm run db:setup`.
4. Start the app with `npm run dev` and use the local API at `http://127.0.0.1:3000/api`.

The default index root resolves to `Downloads` under the current operating-system home/profile. Set `ARCHIVE_ROOT` in `.env` to an existing directory within that profile to change it. Do not set it to a drive root or arbitrary path outside the profile. The initial database includes supported file-format lookup rows, but no fake archive items.

During development, PostgreSQL data is persisted in a local host directory and files are read from the host filesystem. No file binaries are stored in the database container. Setup may need image/package downloads once; the running application itself makes no external network calls. The Next.js commands disable telemetry and bind the app to loopback. Import the local Postman collections in `postman/` to exercise the implemented APIs.

## Features

Browse and organize files, import from disk, extract text from common office and web formats, OCR images and scanned PDFs, and search with keyword, semantic, or hybrid ranking. The local embedding model uses PostgreSQL pgvector. Collections, tags, activity history, archive reports, and an on-demand scan are available in the interface.

Run `npm run worker` in a second terminal to generate embeddings for pending chunks. The model and English OCR data are included in the local installation; the app does not download them at runtime. To use a separate model directory, set `PDA_MODELS_DIR` before starting the app.

The `Basic` and `Exhaustive` Postman collections cover the API. The Exhaustive collection includes an isolated local text fixture and exercises the complete API surface. Point `ARCHIVE_ROOT` at a disposable directory before running it because its scan case processes the selected root.

## Project guidance

See `AGENTS.md` for repository context and contributor workflow. Architecture decisions and implementation notes are in `docs/`.
