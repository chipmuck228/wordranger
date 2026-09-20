/**
 * Server-authoritative Meal STRENGTHEN queue.
 * Candidate V0 / Experimental / Not a Standard.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type {
  ContextualProbeTarget,
  ContextualProbeRoutingResult,
} from "../probe/types";
import { isActiveRecallStrengthenEligible } from "./eligibility";
import {
  MEAL_STRENGTHEN_ORCHESTRATION_VERSION,
  type ContextualStrengthenQueueItem,
} from "./types";

export interface MealStrengthenQueueState {
  version: typeof MEAL_STRENGTHEN_ORCHESTRATION_VERSION;
  items: ContextualStrengthenQueueItem[];
  currentIndex: number;
  completed: LexemeSenseRef[];
  currentPlanId: string | null;
}

export function buildMealStrengthenQueue(input: {
  targets: readonly ContextualProbeTarget[];
  results: readonly ContextualProbeRoutingResult[];
}): ContextualStrengthenQueueItem[] {
  const seen = new Set<string>();
  const items: ContextualStrengthenQueueItem[] = [];
  for (const target of input.targets) {
    const result = input.results.find((item) =>
      sameLexemeSense(item.target, target.target),
    );
    if (
      !result ||
      !isActiveRecallStrengthenEligible({
        target: target.target,
        disposition: result.disposition,
        observations: result.observations,
      })
    ) {
      continue;
    }
    const key = `${target.target.lexemeId}::${target.target.senseId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      target: { ...target.target },
      entityId: target.entityId,
      sourceProbeTaskIds: result.observations.map((item) => item.taskId),
    });
  }
  return items;
}

export function createMealStrengthenQueueState(
  items: readonly ContextualStrengthenQueueItem[],
): MealStrengthenQueueState | null {
  if (items.length === 0) {
    return null;
  }
  return {
    version: MEAL_STRENGTHEN_ORCHESTRATION_VERSION,
    items: items.map((item) => ({
      target: { ...item.target },
      entityId: item.entityId,
      sourceProbeTaskIds: [...item.sourceProbeTaskIds],
    })),
    currentIndex: 0,
    completed: [],
    currentPlanId: null,
  };
}

export function readMealStrengthenQueue(
  value: unknown,
):
  | { ok: true; queue: MealStrengthenQueueState }
  | { ok: false; reason: "STRENGTHEN_QUEUE_PERSISTENCE_GAP" } {
  if (!value || typeof value !== "object") {
    return { ok: false, reason: "STRENGTHEN_QUEUE_PERSISTENCE_GAP" };
  }
  const queue = value as MealStrengthenQueueState;
  if (
    queue.version !== MEAL_STRENGTHEN_ORCHESTRATION_VERSION ||
    !Array.isArray(queue.items) ||
    !Array.isArray(queue.completed) ||
    !Number.isInteger(queue.currentIndex) ||
    queue.currentIndex < 0 ||
    queue.currentIndex > queue.items.length ||
    queue.items.some(
      (item) =>
        !item?.target?.lexemeId?.trim() ||
        !item.target.senseId?.trim() ||
        !item.entityId?.trim() ||
        !Array.isArray(item.sourceProbeTaskIds),
    )
  ) {
    return { ok: false, reason: "STRENGTHEN_QUEUE_PERSISTENCE_GAP" };
  }
  return {
    ok: true,
    queue: {
      version: MEAL_STRENGTHEN_ORCHESTRATION_VERSION,
      items: queue.items.map((item) => ({
        target: { ...item.target },
        entityId: item.entityId,
        sourceProbeTaskIds: [...item.sourceProbeTaskIds],
      })),
      currentIndex: queue.currentIndex,
      completed: queue.completed.map((item) => ({ ...item })),
      currentPlanId: queue.currentPlanId,
    },
  };
}

export function currentStrengthenQueueItem(
  queue: MealStrengthenQueueState,
): ContextualStrengthenQueueItem | null {
  return queue.items[queue.currentIndex] ?? null;
}

export function markStrengthenQueueItemCompleted(
  queue: MealStrengthenQueueState,
  target: LexemeSenseRef,
):
  | { ok: true; queue: MealStrengthenQueueState }
  | { ok: false; reason: "STRENGTHEN_TARGET_IDENTITY_MISMATCH" } {
  const current = currentStrengthenQueueItem(queue);
  if (!current || !sameLexemeSense(current.target, target)) {
    return { ok: false, reason: "STRENGTHEN_TARGET_IDENTITY_MISMATCH" };
  }
  if (queue.completed.some((item) => sameLexemeSense(item, target))) {
    return { ok: true, queue };
  }
  return {
    ok: true,
    queue: {
      ...queue,
      completed: [...queue.completed, { ...target }],
      currentIndex: queue.currentIndex + 1,
      currentPlanId: null,
    },
  };
}

export function strengthenHandoffLabel(count: number): string {
  if (count <= 1) {
    return "开始需要的强化";
  }
  return `开始强化 ${count} 个词`;
}
