import { readFile, readdir } from "node:fs/promises";
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
  const snapshot = await client.query("SELECT 1 FROM schema_migrations WHERE name = 'snapshot-v1'");
  if (!snapshot.rowCount) throw new Error("Canonical schema is not initialized. Run npm run db:setup first.");
  const migrations = (await readdir(join(root, "migrations"))).filter((name) => name.endsWith(".sql")).sort();
  for (const name of migrations) {
    const seen = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
    if (seen.rowCount) continue;
    const sql = await readFile(join(root, "migrations", name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}

function loadEnv() {
  try {
    const contents = requireEnvFile();
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || match[1] in process.env) continue;
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function requireEnvFile() {
  return readFileSync(join(root, "..", ".env"), "utf8");
}
