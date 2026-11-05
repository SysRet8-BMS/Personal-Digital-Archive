import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, parseId, parseIdList } from "@/lib/api";
import { inTransaction } from "@/lib/db";
import { booleanField, dateField, recordBody, stringField, ValidationError } from "@/lib/validation";
import { query } from "@/lib/db";
import { rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveFileInsideRoot } from "@/lib/archive-root";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const id = parseId((await context.params).id);
    return await inTransaction(async (client) => {
      const item = await client.query(
        `SELECT i.item_id AS "itemId", i.title, i.description, i.source, i.file_dir AS "fileDir",
                i.file_name AS "fileName", i.format_id AS "formatId", ff.format_name AS "formatName",
                i.created_at AS "createdAt", i.added_at AS "addedAt", i.updated_at AS "updatedAt",
                i.is_favorite AS "isFavorite", i.is_archived AS "isArchived",
                i.extraction_status AS "extractionStatus", i.extraction_method AS "extractionMethod"
         FROM item i JOIN file_format ff USING (format_id) WHERE i.item_id = $1`, [id]);
      if (!item.rowCount) throw new ApiError(404, "NOT_FOUND", "Item not found.");
      const [chunks, collections, tags] = await Promise.all([
        client.query(`SELECT chunk_id AS "chunkId", seq_no AS "sequence", content, embedding_status AS "embeddingStatus"
                      FROM chunk WHERE item_id = $1 ORDER BY seq_no`, [id]),
        client.query(`SELECT c.collection_id AS "collectionId", c.name, c.parent_id AS "parentId"
                      FROM collection c JOIN item_collection ic USING (collection_id)
                      WHERE ic.item_id = $1 ORDER BY lower(c.name)`, [id]),
        client.query(`SELECT t.tag_id AS "tagId", t.name
                      FROM tag t JOIN item_tag it USING (tag_id) WHERE it.item_id = $1 ORDER BY lower(t.name)`, [id]),
      ]);
      await client.query("INSERT INTO access_log (item_id) VALUES ($1)", [id]);
      return NextResponse.json({ item: item.rows[0], chunks: chunks.rows, collections: collections.rows, tags: tags.rows });
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const id = parseId((await context.params).id);
    const body = recordBody(await request.json());
    const allowed = new Set(["title", "description", "source", "createdAt", "isFavorite", "isArchived", "collectionIds", "tagIds"]);
    for (const key of Object.keys(body)) if (!allowed.has(key)) throw new ValidationError(`Unknown field: ${key}.`);

    const updates: Array<[string, unknown]> = [];
    const title = stringField(body, "title", { max: 255 });
    if (title === "") throw new ValidationError("title cannot be empty.");
    const description = stringField(body, "description", { nullable: true });
    const source = stringField(body, "source", { nullable: true, max: 255 });
    const createdAt = dateField(body, "createdAt");
    const isFavorite = booleanField(body, "isFavorite");
    const isArchived = booleanField(body, "isArchived");
    if (title !== undefined) updates.push(["title", title]);
    if (description !== undefined) updates.push(["description", description]);
    if (source !== undefined) updates.push(["source", source]);
    if (createdAt !== undefined) updates.push(["created_at", createdAt]);
    if (isFavorite !== undefined) updates.push(["is_favorite", isFavorite]);
    if (isArchived !== undefined) updates.push(["is_archived", isArchived]);
    const collectionIds = parseIdList(body.collectionIds, "collectionIds");
    const tagIds = parseIdList(body.tagIds, "tagIds");
    if (!updates.length && collectionIds === undefined && tagIds === undefined) {
      throw new ApiError(400, "EMPTY_PATCH", "Provide at least one field to update.");
    }

    const result = await inTransaction(async (client) => {
      if (updates.length) {
        const values = updates.map(([, value]) => value);
        const assignments = updates.map(([key], index) => `${key} = $${index + 1}`);
        values.push(id);
        const updated = await client.query(
          `UPDATE item SET ${assignments.join(", ")} WHERE item_id = $${values.length}
           RETURNING item_id AS "itemId", title, description, source, file_dir AS "fileDir", file_name AS "fileName",
                     created_at AS "createdAt", added_at AS "addedAt", updated_at AS "updatedAt",
                     is_favorite AS "isFavorite", is_archived AS "isArchived",
                     extraction_status AS "extractionStatus", extraction_method AS "extractionMethod"`, values);
        if (!updated.rowCount) throw new ApiError(404, "NOT_FOUND", "Item not found.");
      } else {
        const exists = await client.query("SELECT 1 FROM item WHERE item_id = $1", [id]);
        if (!exists.rowCount) throw new ApiError(404, "NOT_FOUND", "Item not found.");
      }

      if (collectionIds !== undefined) {
        await assertReferencesExist(client, "collection", "collection_id", collectionIds);
        await client.query("DELETE FROM item_collection WHERE item_id = $1", [id]);
        if (collectionIds.length) await client.query(
          "INSERT INTO item_collection (item_id, collection_id) SELECT $1, unnest($2::int[])", [id, collectionIds]);
      }
      if (tagIds !== undefined) {
        await assertReferencesExist(client, "tag", "tag_id", tagIds);
        await client.query("DELETE FROM item_tag WHERE item_id = $1", [id]);
        if (tagIds.length) await client.query(
          "INSERT INTO item_tag (item_id, tag_id) SELECT $1, unnest($2::int[])", [id, tagIds]);
      }
      const [item, collections, tags] = await Promise.all([
        client.query(`SELECT item_id AS "itemId", title, description, source, file_dir AS "fileDir", file_name AS "fileName",
                      created_at AS "createdAt", added_at AS "addedAt", updated_at AS "updatedAt",
                      is_favorite AS "isFavorite", is_archived AS "isArchived",
                      extraction_status AS "extractionStatus", extraction_method AS "extractionMethod"
                      FROM item WHERE item_id = $1`, [id]),
        client.query(`SELECT c.collection_id AS "collectionId", c.name, c.parent_id AS "parentId"
                      FROM collection c JOIN item_collection ic USING (collection_id)
                      WHERE ic.item_id = $1 ORDER BY lower(c.name)`, [id]),
        client.query(`SELECT t.tag_id AS "tagId", t.name FROM tag t JOIN item_tag it USING (tag_id)
                      WHERE it.item_id = $1 ORDER BY lower(t.name)`, [id]),
      ]);
      return NextResponse.json({ item: item.rows[0], collections: collections.rows, tags: tags.rows });
    });
    return result;
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const id = parseId((await context.params).id);
    let movedFrom: string | undefined;
    let movedTo: string | undefined;
    try {
      await inTransaction(async (client) => {
        const found = await client.query<{file_dir:string;file_name:string}>("SELECT file_dir,file_name FROM item WHERE item_id=$1 FOR UPDATE",[id]);
        if (!found.rowCount) throw new ApiError(404, "NOT_FOUND", "Item not found.");
        try {
          const resolved = await resolveFileInsideRoot(path.join(found.rows[0].file_dir,found.rows[0].file_name));
          movedFrom = resolved.filePath;
          movedTo = path.join(path.dirname(movedFrom),`.pda-delete-${randomUUID()}`);
          await rename(movedFrom,movedTo);
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        await client.query("DELETE FROM item WHERE item_id=$1",[id]);
      });
    } catch (error) {
      if (movedFrom && movedTo) await rename(movedTo,movedFrom).catch(()=>undefined);
      throw error;
    }
    if (movedTo) await rm(movedTo,{force:true}).catch((error)=>console.error("Deleted file cleanup failed",error));
    return new NextResponse(null, { status: 204 });
  } catch (error) { return jsonError(error); }
}

async function assertReferencesExist(client: import("pg").PoolClient, table: "collection" | "tag", key: "collection_id" | "tag_id", ids: number[]) {
  if (!ids.length) return;
  const result = await client.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${key} = ANY($1::int[])`, [ids]);
  if (result.rows[0].count !== ids.length) throw new ApiError(400, "INVALID_REFERENCE", `One or more ${table} IDs do not exist.`);
}
