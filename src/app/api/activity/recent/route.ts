import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [accesses, searches, deletions] = await Promise.all([
      query("SELECT a.log_id AS id,a.accessed_at AS at,i.item_id AS \"itemId\",i.title,'open' AS action FROM access_log a JOIN item i USING(item_id) ORDER BY a.accessed_at DESC LIMIT 100"),
      query("SELECT search_id AS id,searched_at AS at,query_text AS query,search_type AS type,result_count AS \"resultCount\",'search' AS action FROM search_log ORDER BY searched_at DESC LIMIT 100"),
      query("SELECT audit_id AS id,action_at AS at,item_id AS \"itemId\",item_title AS title,action FROM recent_audit_events"),
    ]);
    const events = [...accesses.rows,...searches.rows,...deletions.rows].sort((a,b) => +new Date(String(b.at)) - +new Date(String(a.at))).slice(0,100);
    return NextResponse.json({ events });
  } catch (error) { return jsonError(error); }
}
