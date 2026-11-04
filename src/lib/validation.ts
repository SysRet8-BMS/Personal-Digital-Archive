export class ValidationError extends Error {}

export function recordBody(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ValidationError("Request body must be a JSON object.");
  return value as Record<string, unknown>;
}

export function stringField(body: Record<string, unknown>, key: string, options: { required?: boolean; max?: number; nullable?: boolean } = {}): string | null | undefined {
  const value = body[key];
  if (value === undefined) {
    if (options.required) throw new ValidationError(`${key} is required.`);
    return undefined;
  }
  if (value === null && options.nullable) return null;
  if (typeof value !== "string") throw new ValidationError(`${key} must be a string${options.nullable ? " or null" : ""}.`);
  const normalized = value.trim();
  if (options.required && !normalized) throw new ValidationError(`${key} cannot be empty.`);
  if (options.max && normalized.length > options.max) throw new ValidationError(`${key} must be at most ${options.max} characters.`);
  return normalized;
}

export function booleanField(body: Record<string, unknown>, key: string): boolean | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new ValidationError(`${key} must be a boolean.`);
  return value;
}

export function positiveIdField(body: Record<string, unknown>, key: string, nullable = false): number | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new ValidationError(`${key} must be a positive integer${nullable ? " or null" : ""}.`);
  return Number(value);
}

export function dateField(body: Record<string, unknown>, key: string, nullable = true): string | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)) || !Number.isFinite(new Date(value).getTime())) {
    throw new ValidationError(`${key} must be a valid date${nullable ? " or null" : ""}.`);
  }
  return value;
}
