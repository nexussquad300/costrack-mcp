export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validatePositiveNumber(value: any, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative number, got: ${value}`);
  }
  return num;
}

export function validatePositiveNumberOrUndefined(value: any, fieldName: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return validatePositiveNumber(value, fieldName);
}

export function validateNonEmptyString(value: any, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string, got: ${JSON.stringify(value)}`);
  }
  return value.trim();
}

export function validateStringOrUndefined(value: any, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return validateNonEmptyString(value, fieldName);
}
