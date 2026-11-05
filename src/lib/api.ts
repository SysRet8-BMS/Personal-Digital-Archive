import { NextResponse } from "next/server";
import { ValidationError } from "./validation";
import { ArchiveRootError } from "./archive-root";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.message } }, { status: 400 });
  }
  if (error instanceof ArchiveRootError) {
    return NextResponse.json({ error: { code: "INVALID_ARCHIVE_PATH", message: error.message } }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must contain valid JSON." } }, { status: 400 });
  }
  if (isPgError(error, "23505")) {
    return NextResponse.json({ error: { code: "CONFLICT", message: "A record with these values already exists." } }, { status: 409 });
  }
  if (isPgError(error, "23503")) {
    return NextResponse.json({ error: { code: "INVALID_REFERENCE", message: "A referenced record does not exist." } }, { status: 400 });
  }
  if (isPgError(error, "23514")) {
    return NextResponse.json({ error: { code: "CONFLICT", message: "The requested change violates a database constraint." } }, { status: 409 });
  }
  console.error("API request failed", error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } }, { status: 500 });
}

function isPgError(error: unknown, code: string): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) throw new ApiError(400, "INVALID_ID", "ID must be a positive integer.");
  return id;
}

export function parseIdList(value: unknown, key: string): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${key} must be an array of positive integer IDs.`);
  }
  if (new Set(value).size !== value.length) throw new ApiError(400, "VALIDATION_ERROR", `${key} cannot contain duplicate IDs.`);
  return value as number[];
}

export function parseBooleanParam(value: string | null, key: string): boolean | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ApiError(400, "VALIDATION_ERROR", `${key} must be true or false.`);
}

export function parseDateParam(value: string | null, key: string): string | undefined {
  if (value === null) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "VALIDATION_ERROR", `${key} must use YYYY-MM-DD format.`);
  }
  return value;
}
