import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const r = await query("SELECT search_id AS \"searchId\",query_text AS query,search_type AS type,result_count AS \"resultCount\",searched_at AS \"searchedAt\" FROM search_log ORDER BY searched_at DESC LIMIT 200"); return NextResponse.json({ searches: r.rows }); }
  catch (error) { return jsonError(error); }
}
