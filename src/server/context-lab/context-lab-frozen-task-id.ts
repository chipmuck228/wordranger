import "server-only";

import { createHash } from "node:crypto";

/** Namespace for Context Lab frozen-task UUIDs. Not a game ID. */
const CONTEXT_LAB_TASK_NAMESPACE = "a11c07e1-0000-4000-8000-c07e171ab001";

/**
 * Deterministic learning-task UUID from immutable run + step identity.
 * Compatible with learning_tasks.id (uuid).
 */
export function contextLabFrozenTaskId(runId: string, stepId: string): string {
  return uuidV5(CONTEXT_LAB_TASK_NAMESPACE, `context-lab-frozen:${runId}:${stepId}`);
}

function uuidV5(namespace: string, name: string): string {
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
