import "server-only";

import { createHash } from "node:crypto";

/**
 * RFC 4122 UUID v5. Shared by product surfaces that need deterministic
 * learning_tasks.id values. Namespace + name must stay stable.
 */
export function deterministicUuidV5(namespace: string, name: string): string {
  const hash = createHash("sha1")
    .update(uuidToBytes(namespace))
    .update(name, "utf8")
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return bytesToUuid(hash.subarray(0, 16));
}

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  return Buffer.from(hex, "hex");
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
