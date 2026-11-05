import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getArchiveRoot } from "@/lib/archive-root";
import { embeddingModelAvailable, isEmbeddingModelAvailable } from "@/lib/embeddings.js";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const modelAvailable=await isEmbeddingModelAvailable(); return NextResponse.json({ archiveRoot: await getArchiveRoot(), defaultRoot: "Downloads", embeddingModel: embeddingModelAvailable(), modelAvailable, offlineOnly: true }); }
  catch (error) { return jsonError(error); }
}
