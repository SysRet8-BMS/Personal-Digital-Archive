import pg from "pg";
import { embedText, vectorLiteral } from "../src/lib/embeddings.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
let stopped = false;
process.on("SIGINT", () => { stopped = true; });
process.on("SIGTERM", () => { stopped = true; });
const client = await pool.connect();
try {
  await client.query("SET ROLE embedding_worker");
  while (!stopped) {
    let chunkId;
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT chunk_id,content FROM chunk WHERE embedding_status='pending' ORDER BY chunk_id LIMIT 1 FOR UPDATE SKIP LOCKED");
      if (!result.rowCount) { await client.query("COMMIT"); await delay(1500); continue; }
      chunkId = result.rows[0].chunk_id;
      const vector = vectorLiteral(await embedText(result.rows[0].content));
      await client.query("INSERT INTO embedding(chunk_id,model_name,dimension,vec) VALUES($1,$2,384,$3::vector)",[chunkId,"Xenova/all-MiniLM-L6-v2",vector]);
      await client.query("UPDATE chunk SET embedding_status='done' WHERE chunk_id=$1",[chunkId]);
      await client.query("COMMIT");
    } catch(error) {
      await client.query("ROLLBACK").catch(()=>{});
      if(chunkId) await client.query("UPDATE chunk SET embedding_status='failed' WHERE chunk_id=$1",[chunkId]).catch(()=>{});
      console.error("Embedding worker iteration failed",error);
      await delay(2000);
    }
  }
} finally {
  await client.query("RESET ROLE").catch(()=>{});
  client.release();
  await pool.end();
}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
