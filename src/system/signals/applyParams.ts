import { isPrimitive } from "../../lib/utils.ts";

function normalizeValue(value: unknown): string | string[] | undefined {
  if (isPrimitive(value)) {
    return value.toString().toLowerCase();
  }

  if (Array.isArray(value) && value.every(isPrimitive)) {
    return value.map(normalizeValue).filter((e) =>
      e !== undefined && e !== null && !Array.isArray(e)
    ) as string | string[] | undefined;
  }
}

export function applyParams(
  record: Record<string, unknown>,
  params?: string,
): boolean {
  if (!params || params.length === 0) return true;

  const paramsSegments = params.split(";");
  const normalizedRecord = Object.fromEntries(
    Object.entries(record).map((
      [key, value],
    ) => [key.toLowerCase(), normalizeValue(value)] as const)
      .filter(([_, value]) => value !== undefined),
  );

  for (const segment of paramsSegments) {
    const [category, options] = segment.split("=");
    if (!options) return true;

    const values = options.split("|");
    const recordValue = normalizedRecord[category];

    if (
      Array.isArray(recordValue) &&
      !values.every((v) => recordValue.includes(v))
    ) {
      return false;
    } else if (
      !Array.isArray(recordValue) &&
      (recordValue === undefined ||
        !values.includes(recordValue.toString()))
    ) {
      return false;
    }
  }
  return true;
}
