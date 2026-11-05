import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const root = dirname(fileURLToPath(import.meta.url));
loadEnv();

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const initialized = await client.query("SELECT 1 FROM schema_migrations WHERE name = 'snapshot-v1'");
  if (!initialized.rowCount) {
    const existing = await client.query("SELECT to_regclass('public.item') AS item_table");
    if (existing.rows[0].item_table) {
      throw new Error("Database already has archive tables but no snapshot marker. Back up and reconcile its schema before setup.");
    }
    await client.query("BEGIN");
    try {
      await client.query(await readFile(join(root, "01_ddl.sql"), "utf8"));
      await client.query(await readFile(join(root, "seed.sql"), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ('snapshot-v1')");
      await client.query("INSERT INTO schema_migrations (name) VALUES ('0001_prevent_collection_cycles.sql')");
      await client.query("INSERT INTO schema_migrations (name) VALUES ('0002_recent_audit_events.sql')");
      await client.query("COMMIT");
      console.log("Initialized database from the canonical DDL snapshot and lookup seed.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}

await import("./migrate.mjs");

function loadEnv() {
  try {
    const contents = readFileSync(join(root, "..", ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || match[1] in process.env) continue;
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
