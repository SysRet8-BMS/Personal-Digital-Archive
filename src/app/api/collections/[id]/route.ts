import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, parseId } from "@/lib/api";
import { inTransaction, query } from "@/lib/db";
import { positiveIdField, recordBody, stringField, ValidationError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const id = parseId((await context.params).id);
    const body = recordBody(await request.json());
    for (const key of Object.keys(body)) if (!["name", "parentId"].includes(key)) throw new ValidationError(`Unknown field: ${key}.`);
    const name = stringField(body, "name", { max: 100 });
    if (name === "") throw new ValidationError("name cannot be empty.");
    const parentId = positiveIdField(body, "parentId", true);
    if (name === undefined && parentId === undefined) throw new ApiError(400, "EMPTY_PATCH", "Provide name or parentId.");
    return await inTransaction(async (client) => {
      const current = await client.query("SELECT collection_id, parent_id FROM collection WHERE collection_id = $1 FOR UPDATE", [id]);
      if (!current.rowCount) throw new ApiError(404, "NOT_FOUND", "Collection not found.");
      const nextParent = parentId === undefined ? current.rows[0].parent_id : parentId;
      if (nextParent !== null) {
        const parent = await client.query("SELECT 1 FROM collection WHERE collection_id = $1", [nextParent]);
        if (!parent.rowCount) throw new ApiError(400, "INVALID_REFERENCE", "parentId does not exist.");
      }
      const result = await client.query(
        `UPDATE collection SET name = COALESCE($1, name), parent_id = $2 WHERE collection_id = $3
         RETURNING collection_id AS "collectionId", name, parent_id AS "parentId", created_at AS "createdAt"`,
        [name ?? null, nextParent, id],
      );
      return NextResponse.json({ collection: result.rows[0] });
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const id = parseId((await context.params).id);
    const result = await query("DELETE FROM collection WHERE collection_id = $1", [id]);
    if (!result.rowCount) throw new ApiError(404, "NOT_FOUND", "Collection not found.");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
