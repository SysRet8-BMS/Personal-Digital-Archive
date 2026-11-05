import { readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError, ApiError } from "@/lib/api";
import { getArchiveRoot } from "@/lib/archive-root";
import { ingestFile } from "@/lib/ingest";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
type Scan = { scanId: string; status: "running"|"complete"|"failed"; discovered: number; indexed: number; failed: number; skipped: number; startedAt: string; error?: string };
const globalForScans = globalThis as typeof globalThis & { archiveScans?: Map<string,Scan> };
export const scans = globalForScans.archiveScans ?? (globalForScans.archiveScans = new Map<string,Scan>());
let active = false;
const extensions = new Set([".txt",".md",".markdown",".pdf",".docx",".pptx",".xlsx",".xls",".csv",".html",".htm",".png",".jpg",".jpeg"]);

export async function POST() {
  try {
    if (active) throw new ApiError(409,"SCAN_RUNNING","A scan is already running.");
    const root = await getArchiveRoot();
    const scan: Scan = { scanId: randomUUID(),status:"running",discovered:0,indexed:0,failed:0,skipped:0,startedAt:new Date().toISOString() };
    scans.set(scan.scanId,scan); active=true;
    void runScan(root,scan).finally(() => { active=false; });
    return NextResponse.json(scan,{status:202});
  } catch(error) { return jsonError(error); }
}
export async function GET() { return NextResponse.json({ scans: [...scans.values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)) }); }

async function runScan(root: string, scan: Scan) {
  try {
    const walk = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory,{withFileTypes:true})) {
        if (entry.name === ".pda-imports" || entry.name.startsWith(".")) continue;
        const candidate = path.join(directory,entry.name);
        if (entry.isSymbolicLink()) { scan.skipped++; continue; }
        if (entry.isDirectory()) { await walk(candidate); continue; }
        if (!entry.isFile()) continue;
        scan.discovered++;
        if (!extensions.has(path.extname(entry.name).toLowerCase())) { scan.skipped++; continue; }
        try {
          const exists=await query("SELECT 1 FROM item WHERE file_dir=$1 AND file_name=$2",[directory,entry.name]);
          if(exists.rowCount){scan.skipped++;continue;}
          await ingestFile(candidate); scan.indexed++;
        }
        catch(error) { scan.failed++; console.error("Scan could not index a file",error); }
      }
    };
    await walk(root); scan.status="complete";
  } catch(error) { scan.status="failed"; scan.error=error instanceof Error?error.message:"Scan failed"; }
}
