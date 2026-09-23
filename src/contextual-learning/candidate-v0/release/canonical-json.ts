export function sortedJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => sortedJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${sortedJson(record[key])}`)
    .join(",")}}`;
}

export function serializeReleaseValue(value: unknown): string {
  return `${sortedJson(value)}\n`;
}
