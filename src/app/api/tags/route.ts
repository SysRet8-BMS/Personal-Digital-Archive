import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { query } from "@/lib/db";
import { recordBody, stringField } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const rows = await query(
      `SELECT t.tag_id AS "tagId", t.name, count(it.item_id)::int AS "usageCount"
       FROM tag t LEFT JOIN item_tag it USING (tag_id)
       ${q ? "WHERE t.name ILIKE '%' || $1 || '%'" : ""}
       GROUP BY t.tag_id, t.name ORDER BY lower(t.name), t.tag_id`, q ? [q] : [],
    );
    return NextResponse.json({ tags: rows.rows });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = recordBody(await request.json());
    const name = stringField(body, "name", { required: true, max: 50 })!;
    const result = await query(
      "INSERT INTO tag (name) VALUES ($1) RETURNING tag_id AS \"tagId\", name",
      [name],
    );
    return NextResponse.json({ tag: { ...result.rows[0], usageCount: 0 } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
