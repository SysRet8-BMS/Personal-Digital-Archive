import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, parseDateParam, parseId } from "@/lib/api";
import { query } from "@/lib/db";
import { embedText, vectorLiteral } from "@/lib/embeddings.js";
import { recordBody, stringField } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const body = recordBody(await request.json());
    const allowed = new Set(["query", "type", "formatId", "tagId", "collectionId", "dateFrom", "dateTo", "favorite", "archived", "limit"]);
    for (const key of Object.keys(body)) if (!allowed.has(key)) throw new ApiError(400, "VALIDATION_ERROR", `Unknown field: ${key}.`);
    const term = stringField(body, "query", { max: 2000 })?.trim() || null;
    const type = stringField(body, "type", { max: 10 }) ?? (term ? "hybrid" : "filter");
    if (!["filter", "keyword", "semantic", "hybrid"].includes(type)) throw new ApiError(400, "VALIDATION_ERROR", "type must be filter, keyword, semantic, or hybrid.");
    if (["semantic", "hybrid"].includes(type) && !term) throw new ApiError(400, "VALIDATION_ERROR", "Semantic and hybrid searches require query text.");
    const formatId = optionalId(body.formatId, "formatId");
    const tagId = optionalId(body.tagId, "tagId");
    const collectionId = optionalId(body.collectionId, "collectionId");
    const dateFrom = parseDateParam(body.dateFrom === undefined ? null : String(body.dateFrom), "dateFrom");
    const dateTo = parseDateParam(body.dateTo === undefined ? null : String(body.dateTo), "dateTo");
    if (dateFrom && dateTo && dateFrom > dateTo) throw new ApiError(400, "VALIDATION_ERROR", "dateFrom must be on or before dateTo.");
    const limit = body.limit === undefined ? 50 : Number(body.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, "VALIDATION_ERROR", "limit must be between 1 and 100.");
    let items;
    if (type === "filter" || type === "keyword") {
      const result = await query(`SELECT s.item_id AS "itemId",s.title,s.rank FROM search_items($1,$2,$3,$4,$5,$6) s
        JOIN item i USING(item_id) WHERE ($7::boolean IS NULL OR i.is_favorite=$7) AND ($8::boolean IS NULL OR i.is_archived=$8)
        ORDER BY s.rank DESC, s.item_id DESC LIMIT $9`, [type === "filter" ? null : term, formatId, tagId, collectionId, dateFrom, dateTo, optionalBool(body.favorite, "favorite"), optionalBool(body.archived, "archived"), limit]);
      items = result.rows;
    } else {
      const vector = vectorLiteral(await embedText(term!));
      const result = await query(`WITH semantic AS (
        SELECT i.item_id,i.title, min(e.vec <=> $1::vector) AS distance
        FROM embedding e JOIN chunk c USING(chunk_id) JOIN item i USING(item_id)
        WHERE ($2::int IS NULL OR i.format_id=$2) AND ($3::int IS NULL OR EXISTS (SELECT 1 FROM item_tag x WHERE x.item_id=i.item_id AND x.tag_id=$3))
          AND ($4::int IS NULL OR EXISTS (SELECT 1 FROM item_collection x WHERE x.item_id=i.item_id AND x.collection_id=$4))
          AND ($5::date IS NULL OR i.added_at::date >= $5) AND ($6::date IS NULL OR i.added_at::date <= $6)
          AND ($7::boolean IS NULL OR i.is_favorite=$7) AND ($8::boolean IS NULL OR i.is_archived=$8)
        GROUP BY i.item_id,i.title ORDER BY distance LIMIT $9
      ), keyword AS (
        SELECT si.item_id,si.title,si.rank FROM search_items($10,$2,$3,$4,$5,$6) si JOIN item i USING(item_id)
        WHERE ($7::boolean IS NULL OR i.is_favorite=$7) AND ($8::boolean IS NULL OR i.is_archived=$8)
      ), combined AS (
        SELECT coalesce(s.item_id,k.item_id) AS item_id,coalesce(s.title,k.title) AS title,s.distance,k.rank
        FROM semantic s FULL OUTER JOIN keyword k USING(item_id)
      ) SELECT item_id AS "itemId",title,CASE WHEN distance IS NULL THEN NULL ELSE 1-distance END AS "semanticScore",coalesce(rank,0) AS "keywordScore"
        FROM combined WHERE $11='hybrid' OR distance IS NOT NULL
        ORDER BY CASE WHEN $11='hybrid' THEN coalesce(1-distance,0)*0.7+least(coalesce(rank,0),1)*0.3 ELSE 1-distance END DESC LIMIT $9`,
        [vector, formatId, tagId, collectionId, dateFrom, dateTo, optionalBool(body.favorite,"favorite"), optionalBool(body.archived,"archived"), limit, term, type]);
      items = result.rows;
    }
    const logged = await query<{search_id:string}>(`INSERT INTO search_log(query_text,search_type,filter_format_id,filter_collection_id,filter_date_from,filter_date_to,result_count)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING search_id`, [term, type, formatId, collectionId, dateFrom, dateTo, items.length]);
    if (tagId) await query("INSERT INTO search_log_tag(search_id,tag_id) VALUES($1,$2)",[logged.rows[0].search_id,tagId]);
    return NextResponse.json({ items, total: items.length, type, searchId: logged.rows[0].search_id });
  } catch (error) { return jsonError(error); }
}

function optionalId(value: unknown, name: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  return parseId(String(value));
}
function optionalBool(value: unknown, name: string): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") throw new ApiError(400, "VALIDATION_ERROR", `${name} must be a boolean.`);
  return value;
}
