import { NextRequest, NextResponse } from "next/server";
import { jsonError, ApiError } from "@/lib/api";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
const reports: Record<string, string> = {
  overview: "SELECT * FROM item_summary ORDER BY added_at DESC LIMIT 500",
  collections: "SELECT * FROM stats_collection ORDER BY item_count DESC,name",
  tags: "SELECT * FROM stats_tag ORDER BY usage_count DESC,name",
  formats: "SELECT * FROM stats_format ORDER BY item_count DESC,format_name",
  recent: "SELECT * FROM recent_items",
  untagged: "SELECT i.item_id,i.title,i.added_at FROM item i WHERE NOT EXISTS(SELECT 1 FROM item_tag it WHERE it.item_id=i.item_id) ORDER BY i.added_at DESC",
  unusedTags: "SELECT tag_id,name FROM tag WHERE NOT EXISTS(SELECT 1 FROM item_tag it WHERE it.tag_id=tag.tag_id) ORDER BY lower(name)",
  aboveAverageAccess: "SELECT i.item_id,i.title,count(a.log_id)::int AS access_count FROM item i JOIN access_log a USING(item_id) GROUP BY i.item_id,i.title HAVING count(a.log_id)>(SELECT avg(n) FROM (SELECT count(*) n FROM access_log GROUP BY item_id) x) ORDER BY access_count DESC",
};
export async function GET(_request: NextRequest, context: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await context.params;
    const sql = reports[name];
    if (!sql) throw new ApiError(404,"NOT_FOUND","Report not found.");
    const result = await query(sql);
    return NextResponse.json({ name, data: result.rows });
  } catch (error) { return jsonError(error); }
}
