import "server-only";

/**
 * Walk own enumerable property names of a JSON-compatible value.
 * Arrays are traversed, but indexes and primitive string values are not keys.
 * WeakSet guards accidental cycles; public DTOs are still JSON-compatible.
 */
export function forEachObjectKey(
  value: unknown,
  visit: (key: string) => void,
  seen: WeakSet<object> = new WeakSet(),
): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      forEachObjectKey(item, visit, seen);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key);
    forEachObjectKey(child, visit, seen);
  }
}
