import { createHash } from "node:crypto";

export function sourceCanonicalKey(sourceIndex: number): string {
  return `src-${String(sourceIndex).padStart(4, "0")}`;
}

export function canonicalUuid(kind: string, key: string): string {
  const hash = createHash("sha1")
    .update(`wordranger:${kind}:${key}`)
    .digest();
  const bytes = Uint8Array.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function sourceEntryId(sourceIndex: number): string {
  return canonicalUuid("source", sourceCanonicalKey(sourceIndex));
}

export function lexemeIdFromCanonicalKey(canonicalKey: string): string {
  return canonicalUuid("lexeme", canonicalKey);
}

export function relationIdFromCanonicalKey(canonicalKey: string): string {
  return canonicalUuid("relation", canonicalKey);
}
