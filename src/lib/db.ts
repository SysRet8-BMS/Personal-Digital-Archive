import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { archivePool?: Pool };

export const pool = globalForPg.archivePool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
});

if (process.env.NODE_ENV !== "production") globalForPg.archivePool = pool;

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return withAppRole((client) => client.query<T>(text, values));
}

export async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withAppRole(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function withAppRole<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SET ROLE archive_app");
    return await fn(client);
  } finally {
    await client.query("RESET ROLE").catch(() => undefined);
    client.release();
  }
}
