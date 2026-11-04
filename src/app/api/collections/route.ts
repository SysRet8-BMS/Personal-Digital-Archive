import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api";
import { query } from "@/lib/db";
import { positiveIdField, recordBody, stringField } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type CollectionRow = { collectionId: number; name: string; parentId: number | null; createdAt: Date };

export async function GET(request: NextRequest) {
  try {
    const rows = await query<CollectionRow>(`SELECT collection_id AS "collectionId", name, parent_id AS "parentId", created_at AS "createdAt"
                                              FROM collection ORDER BY lower(name), collection_id`);
    if (request.nextUrl.searchParams.get("tree") !== "true") return NextResponse.json({ collections: rows.rows });
    const nodes = rows.rows.map((row) => ({ ...row, children: [] as typeof rows.rows }));
    const byId = new Map(nodes.map((node) => [node.collectionId, node]));
    const roots: typeof nodes = [];
    for (const node of nodes) {
      const parent = node.parentId === null ? undefined : byId.get(node.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return NextResponse.json({ collections: roots });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = recordBody(await request.json());
    const name = stringField(body, "name", { required: true, max: 100 })!;
    const parentId = positiveIdField(body, "parentId", true);
    if (parentId) {
      const parent = await query("SELECT 1 FROM collection WHERE collection_id = $1", [parentId]);
      if (!parent.rowCount) throw new ApiError(400, "INVALID_REFERENCE", "parentId does not exist.");
    }
    const result = await query(
      `INSERT INTO collection (name, parent_id) VALUES ($1, $2)
       RETURNING collection_id AS "collectionId", name, parent_id AS "parentId", created_at AS "createdAt"`,
      [name, parentId ?? null],
    );
    return NextResponse.json({ collection: result.rows[0] }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
