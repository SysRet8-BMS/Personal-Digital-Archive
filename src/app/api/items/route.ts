import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, parseBooleanParam, parseDateParam } from "@/lib/api";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limit = parsePageNumber(params.get("limit"), 50, 100, "limit");
    const offset = parsePageNumber(params.get("offset"), 0, 1_000_000, "offset");
    const queryText = params.get("q")?.trim();
    const formatId = optionalPositiveId(params.get("formatId"), "formatId");
    const tagId = optionalPositiveId(params.get("tagId"), "tagId");
    const collectionId = optionalPositiveId(params.get("collectionId"), "collectionId");
    const dateFrom = parseDateParam(params.get("dateFrom"), "dateFrom");
    const dateTo = parseDateParam(params.get("dateTo"), "dateTo");
    const favorite = parseBooleanParam(params.get("favorite"), "favorite");
    const archived = parseBooleanParam(params.get("archived"), "archived");
    if (dateFrom && dateTo && dateFrom > dateTo) throw new ApiError(400, "VALIDATION_ERROR", "dateFrom must be on or before dateTo.");

    const values: unknown[] = [];
    const where: string[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      where.push(sql.replace("?", `$${values.length}`));
    };
    if (queryText) add("i.title ILIKE '%' || ? || '%'", queryText);
    if (formatId) add("i.format_id = ?", formatId);
    if (tagId) add("EXISTS (SELECT 1 FROM item_tag it WHERE it.item_id = i.item_id AND it.tag_id = ?)", tagId);
    if (collectionId) add("EXISTS (SELECT 1 FROM item_collection ic WHERE ic.item_id = i.item_id AND ic.collection_id = ?)", collectionId);
    if (dateFrom) add("i.added_at::date >= ?::date", dateFrom);
    if (dateTo) add("i.added_at::date <= ?::date", dateTo);
    if (favorite !== undefined) add("i.is_favorite = ?", favorite);
    if (archived !== undefined) add("i.is_archived = ?", archived);

    const condition = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await query<{ total: string }>(`SELECT count(*) AS total FROM item i ${condition}`, values);
    const rows = await query(
      `SELECT i.item_id AS "itemId", i.title, i.description, i.source, i.file_dir AS "fileDir",
              i.file_name AS "fileName", i.format_id AS "formatId", ff.format_name AS "formatName",
              i.created_at AS "createdAt", i.added_at AS "addedAt", i.updated_at AS "updatedAt",
              i.is_favorite AS "isFavorite", i.is_archived AS "isArchived",
              i.extraction_status AS "extractionStatus", i.extraction_method AS "extractionMethod"
       FROM item i JOIN file_format ff USING (format_id) ${condition}
       ORDER BY i.added_at DESC, i.item_id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    return NextResponse.json({ items: rows.rows, total: Number(count.rows[0].total), limit, offset });
  } catch (error) {
    return jsonError(error);
  }
}

function parsePageNumber(value: string | null, fallback: number, max: number, key: string): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw new ApiError(400, "VALIDATION_ERROR", `${key} must be a non-negative integer.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max || (key === "limit" && number < 1)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${key} is outside the allowed range.`);
  }
  return number;
}

function optionalPositiveId(value: string | null, key: string): number | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 2_147_483_647 || !Number.isSafeInteger(Number(value))) {
    throw new ApiError(400, "VALIDATION_ERROR", `${key} must be a positive integer.`);
  }
  return Number(value);
}
