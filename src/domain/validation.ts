const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  Object.prototype.toString.call(value) === "[object Object]";

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

class ValidationError extends Error {}

export { isPositiveFinite, isRecord, ValidationError };
