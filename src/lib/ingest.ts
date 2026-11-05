import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { inTransaction } from "./db";
import { containsPath, getArchiveRoot, resolveFileInsideRoot, ArchiveRootError } from "./archive-root";
import { extractFile } from "./extraction";
import { ApiError } from "./api";

const mimeByExtension: Record<string, string> = {
  txt: "text/plain", md: "text/markdown", markdown: "text/markdown", pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv",
  html: "text/html", htm: "text/html", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
};

export async function ingestFile(inputPath: string, options: { title?: string; description?: string | null; source?: string | null; deleteOriginal?: boolean; collectionIds?: number[]; tagIds?: number[] } = {}) {
  const root = await getArchiveRoot();
  const originalPath = path.resolve(inputPath);
  const info = await stat(originalPath).catch(() => null);
  if (!info?.isFile()) throw new ApiError(400, "INVALID_FILE", "The selected source must be an existing file.");
  const name = path.basename(originalPath);
  const title = options.title?.trim() || path.basename(name, path.extname(name));
  if (!title) throw new ApiError(400, "VALIDATION_ERROR", "Title cannot be empty.");
  let storedPath: string;
  let copied = false;
  let inside = false;
  try {
    const checked = await resolveFileInsideRoot(originalPath);
    storedPath = checked.filePath;
    inside = true;
  } catch {
    if (containsPath(root, originalPath)) throw new ArchiveRootError("A file inside the selected root resolves outside it through a symbolic link.");
    const targetDir = path.join(root, ".pda-imports");
    await mkdir(targetDir, { recursive: true });
    storedPath = path.join(targetDir, `${randomUUID()}-${name.slice(-160)}`);
    await copyFile(originalPath, storedPath);
    copied = true;
  }
  const extension = path.extname(name).slice(1).toLowerCase();
  const mime = mimeByExtension[extension] ?? "application/octet-stream";
  const extraction = await extractFile(storedPath);
  let itemId: number;
  try {
    itemId = await inTransaction(async (client) => {
      const called = await client.query<{ o_item_id: number }>(
        "CALL add_item($1,$2,$3,$4,$5,$6,$7,$8,NULL)",
        [title, options.description ?? null, options.source ?? null, path.dirname(storedPath), path.basename(storedPath), mime, info.mtime, extraction.chunks.length ? extraction.chunks : null],
      );
      const id = called.rows[0]?.o_item_id;
      if (!id) throw new Error("add_item did not return an item ID");
      await client.query("UPDATE item SET extraction_status=$1, extraction_method=$2 WHERE item_id=$3", [extraction.status, extraction.method || null, id]);
      if (options.collectionIds?.length) await client.query("INSERT INTO item_collection(item_id,collection_id) SELECT $1, unnest($2::int[])", [id, options.collectionIds]);
      if (options.tagIds?.length) await client.query("INSERT INTO item_tag(item_id,tag_id) SELECT $1, unnest($2::int[])", [id, options.tagIds]);
      return id;
    });
  } catch (error) {
    if (copied) await rm(storedPath, { force: true });
    throw error;
  }
  let sourceDeleted = false;
  if (!inside && options.deleteOriginal === true) {
    try { await rm(originalPath); sourceDeleted = true; }
    catch (error) { console.error("Original file could not be deleted after import", error); }
  }
  return { itemId, copied, sourceDeleted, extractionStatus: extraction.status, extractionMethod: extraction.method };
}

export async function ingestUpload(file: File, metadata: Parameters<typeof ingestFile>[1] = {}) {
  const root = await getArchiveRoot();
  const dir = path.join(root, ".pda-imports");
  await mkdir(dir, { recursive: true });
  const safeName = path.basename(file.name.replace(/[\\/]/g,path.sep)) || "upload.bin";
  const destination = path.join(dir, `${randomUUID()}-${safeName.slice(-160)}`);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(destination, Buffer.from(await file.arrayBuffer()));
  try {
    const result = await ingestFile(destination, { ...metadata, title: metadata.title?.trim() || path.basename(safeName,path.extname(safeName)) });
    return { ...result, copied: false };
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  }
}
