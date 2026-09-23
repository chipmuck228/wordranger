/**
 * Shared fail-closed contextual target queue.
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Queue state is Candidate orchestration, not a Scheduler.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";

export interface ContextualTargetQueueItem {
  target: LexemeSenseRef;
  entityId: string;
  sourceProbeTaskIds: readonly string[];
}

export interface ContextualTargetQueueState<Version extends string = string> {
  version: Version;
  items: ContextualTargetQueueItem[];
  currentIndex: number;
  completed: LexemeSenseRef[];
  currentPlanId: string | null;
}

export interface QueueCatalogBinding {
  target: LexemeSenseRef;
  entityId: string;
}

export function createContextualTargetQueueState<Version extends string>(
  version: Version,
  items: readonly ContextualTargetQueueItem[],
): ContextualTargetQueueState<Version> | null {
  if (items.length === 0) {
    return null;
  }
  return {
    version,
    items: items.map(cloneQueueItem),
    currentIndex: 0,
    completed: [],
    currentPlanId: null,
  };
}

export function currentQueueItem<Version extends string>(
  queue: ContextualTargetQueueState<Version>,
): ContextualTargetQueueItem | null {
  return queue.items[queue.currentIndex] ?? null;
}

export function markQueueItemCompleted<Version extends string>(
  queue: ContextualTargetQueueState<Version>,
  target: LexemeSenseRef,
):
  | { ok: true; queue: ContextualTargetQueueState<Version> }
  | { ok: false; reason: "QUEUE_TARGET_IDENTITY_MISMATCH" } {
  const current = currentQueueItem(queue);
  if (!current || !sameLexemeSense(current.target, target)) {
    return { ok: false, reason: "QUEUE_TARGET_IDENTITY_MISMATCH" };
  }
  if (queue.completed.some((item) => sameLexemeSense(item, target))) {
    return { ok: true, queue };
  }
  return {
    ok: true,
    queue: {
      ...queue,
      items: queue.items.map(cloneQueueItem),
      completed: [...queue.completed.map((item) => ({ ...item })), { ...target }],
      currentIndex: queue.currentIndex + 1,
      currentPlanId: null,
    },
  };
}

export function readContextualTargetQueue<Version extends string>(input: {
  value: unknown;
  expectedVersion: Version;
  catalog: readonly QueueCatalogBinding[];
  gapReason: string;
}):
  | { ok: true; queue: ContextualTargetQueueState<Version> }
  | { ok: false; reason: string } {
  const { value, expectedVersion, catalog, gapReason } = input;
  if (!value || typeof value !== "object") {
    return { ok: false, reason: gapReason };
  }
  const raw = value as Record<string, unknown>;
  if (raw.version !== expectedVersion) {
    return { ok: false, reason: gapReason };
  }
  if (!Array.isArray(raw.items) || !Array.isArray(raw.completed)) {
    return { ok: false, reason: gapReason };
  }
  if (!Number.isInteger(raw.currentIndex)) {
    return { ok: false, reason: gapReason };
  }
  const currentIndex = raw.currentIndex as number;
  if (currentIndex < 0 || currentIndex > raw.items.length) {
    return { ok: false, reason: gapReason };
  }
  if (
    raw.currentPlanId !== null &&
    (typeof raw.currentPlanId !== "string" || !raw.currentPlanId.trim())
  ) {
    return { ok: false, reason: gapReason };
  }
  const currentPlanId = raw.currentPlanId as string | null;

  const items: ContextualTargetQueueItem[] = [];
  const seenTargets = new Set<string>();
  const seenTaskIds = new Set<string>();
  let lastCatalogIndex = -1;

  for (const item of raw.items) {
    if (!item || typeof item !== "object") {
      return { ok: false, reason: gapReason };
    }
    const row = item as ContextualTargetQueueItem;
    const lexemeId = row.target?.lexemeId?.trim() ?? "";
    const senseId = row.target?.senseId?.trim() ?? "";
    const entityId = row.entityId?.trim() ?? "";
    if (!lexemeId || !senseId || !entityId) {
      return { ok: false, reason: gapReason };
    }
    if (!Array.isArray(row.sourceProbeTaskIds) || row.sourceProbeTaskIds.length === 0) {
      return { ok: false, reason: gapReason };
    }
    const taskIds: string[] = [];
    for (const taskId of row.sourceProbeTaskIds) {
      if (typeof taskId !== "string" || !taskId.trim()) {
        return { ok: false, reason: gapReason };
      }
      if (seenTaskIds.has(taskId) || taskIds.includes(taskId)) {
        return { ok: false, reason: gapReason };
      }
      seenTaskIds.add(taskId);
      taskIds.push(taskId);
    }
    const targetKey = `${lexemeId}::${senseId}`;
    if (seenTargets.has(targetKey)) {
      return { ok: false, reason: gapReason };
    }
    seenTargets.add(targetKey);

    const catalogIndex = catalog.findIndex(
      (binding) =>
        sameLexemeSense(binding.target, { lexemeId, senseId }) &&
        binding.entityId === entityId,
    );
    if (catalogIndex === -1 || catalogIndex <= lastCatalogIndex) {
      return { ok: false, reason: gapReason };
    }
    lastCatalogIndex = catalogIndex;
    items.push({
      target: { lexemeId, senseId },
      entityId,
      sourceProbeTaskIds: taskIds,
    });
  }

  const completed: LexemeSenseRef[] = [];
  const seenCompleted = new Set<string>();
  for (const item of raw.completed) {
    if (!item || typeof item !== "object") {
      return { ok: false, reason: gapReason };
    }
    const lexemeId = (item as LexemeSenseRef).lexemeId?.trim() ?? "";
    const senseId = (item as LexemeSenseRef).senseId?.trim() ?? "";
    if (!lexemeId || !senseId) {
      return { ok: false, reason: gapReason };
    }
    const key = `${lexemeId}::${senseId}`;
    if (seenCompleted.has(key)) {
      return { ok: false, reason: gapReason };
    }
    seenCompleted.add(key);
    completed.push({ lexemeId, senseId });
  }

  if (completed.length !== currentIndex) {
    return { ok: false, reason: gapReason };
  }
  for (let index = 0; index < completed.length; index += 1) {
    if (!sameLexemeSense(completed[index]!, items[index]!.target)) {
      return { ok: false, reason: gapReason };
    }
  }
  if (currentIndex === items.length && currentPlanId !== null) {
    return { ok: false, reason: gapReason };
  }

  return {
    ok: true,
    queue: {
      version: expectedVersion,
      items,
      currentIndex,
      completed,
      currentPlanId,
    },
  };
}

export function queueHandoffLabel(kind: "BUILD" | "STRENGTHEN", count: number): string {
  if (kind === "BUILD") {
    return `开始建立 ${count} 个词`;
  }
  return `开始强化 ${count} 个词`;
}

function cloneQueueItem(item: ContextualTargetQueueItem): ContextualTargetQueueItem {
  return {
    target: { ...item.target },
    entityId: item.entityId,
    sourceProbeTaskIds: [...item.sourceProbeTaskIds],
  };
}
