import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, parseId } from "@/lib/api";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const id=parseId((await context.params).id);
    const result=await query("DELETE FROM tag WHERE tag_id=$1 RETURNING tag_id",[id]);
    if(!result.rowCount) throw new ApiError(404,"NOT_FOUND","Tag not found.");
    return new NextResponse(null,{status:204});
  } catch(error) { return jsonError(error); }
}
