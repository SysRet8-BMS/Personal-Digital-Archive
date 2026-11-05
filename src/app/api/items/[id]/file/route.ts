import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, parseId } from "@/lib/api";
import { query } from "@/lib/db";
import { resolveFileInsideRoot } from "@/lib/archive-root";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await context.params).id);
    const result = await query<{ file_dir: string; file_name: string; mime_type: string }>("SELECT i.file_dir,i.file_name,ff.mime_type FROM item i JOIN file_format ff USING(format_id) WHERE item_id=$1", [id]);
    if (!result.rowCount) throw new ApiError(404, "NOT_FOUND", "Item not found.");
    const row = result.rows[0];
    const checked = await resolveFileInsideRoot(`${row.file_dir}/${row.file_name}`);
    const bytes = await readFile(checked.filePath);
    return new NextResponse(bytes, { headers: { "Content-Type": row.mime_type, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`, "Content-Length": String(bytes.byteLength) } });
  } catch (error) { return jsonError(error); }
}
