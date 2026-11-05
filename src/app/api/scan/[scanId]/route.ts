import { NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api";
import { scans } from "../route";
export async function GET(_request: Request, context: { params: Promise<{ scanId: string }> }) {
  try { const {scanId}=await context.params; const scan=scans.get(scanId); if(!scan) throw new ApiError(404,"NOT_FOUND","Scan not found."); return NextResponse.json(scan); }
  catch(error) { return jsonError(error); }
}
