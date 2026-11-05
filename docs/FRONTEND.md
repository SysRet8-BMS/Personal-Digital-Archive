# Frontend Notes

The local Next.js interface provides item browsing and detail, import and root scanning, search, collection/tag management, activity, reports, and local settings. Keep browser assets local and never call a hosted service.

Recommended first UI sequence:

1. Browse items and inspect item detail, extraction status, and available content.
2. Import files or scan the selected root; a path import can copy an external file into the archive.
3. Use search, collections, tags, activity, reports, and settings from the navigation.

Use server components for initial reads where useful and local API routes for mutations. Keep all path checks and filesystem access on the server; never accept a browser-provided path as trusted. Archive scans are explicit and limited to the selected root.
