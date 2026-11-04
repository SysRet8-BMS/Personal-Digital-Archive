# Frontend Notes

The initial implementation checkpoint is API-only. Build the Next.js pages after the corresponding API flows are available. Keep browser assets local and never call a hosted service. The first pages should consume item list/detail/update, collection, and tag APIs; later pages can add ingest, search, activity, and reports.

Recommended first UI sequence:

1. Browse items with pagination and metadata filters.
2. Item detail with favorite/archive, editable metadata, and collection/tag assignment.
3. Collection tree and tag views.
4. Add/import and processing statuses after the ingest APIs are complete.

Use server components for initial reads where useful and local API routes for mutations. Keep all path checks and filesystem access on the server; never accept a browser-provided path as trusted.
