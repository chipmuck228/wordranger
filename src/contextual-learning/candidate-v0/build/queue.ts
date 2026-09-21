/**
 * Server-authoritative Meal BUILD queue.
 * Candidate V0 / Experimental / Not a Standard.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type {
  ContextualProbeTarget,
  ContextualProbeRoutingResult,
} from "../probe/types";
import {
  createContextualTargetQueueState,
  currentQueueItem,
  markQueueItemCompleted,
  queueHandoffLabel,
  readContextualTargetQueue,
  type ContextualTargetQueueItem,
  type ContextualTargetQueueState,
} from "../queue/target-queue";
import { isActiveRecallBuildEligible } from "./eligibility";
import { mealLexicalQueueCatalog } from "./meal-lexical-build-profiles";
import { MEAL_BUILD_ORCHESTRATION_VERSION } from "./types";

export type ContextualBuildQueueItem = ContextualTargetQueueItem;
export type MealBuildQueueState =
  ContextualTargetQueueState<typeof MEAL_BUILD_ORCHESTRATION_VERSION>;

export function buildMealBuildQueue(input: {
  targets: readonly ContextualProbeTarget[];
  results: readonly ContextualProbeRoutingResult[];
}):
  | { ok: true; items: ContextualBuildQueueItem[] }
  | { ok: false; reason: "BUILD_ELIGIBILITY_MISMATCH" } {
  const seen = new Set<string>();
  const items: ContextualBuildQueueItem[] = [];
  for (const target of input.targets) {
    const result = input.results.find((item) =>
      sameLexemeSense(item.target, target.target),
    );
    if (!result || result.disposition !== "BUILD") {
      continue;
    }
    if (
      !isActiveRecallBuildEligible({
        target: target.target,
        disposition: result.disposition,
        observations: result.observations,
      })
    ) {
      return { ok: false, reason: "BUILD_ELIGIBILITY_MISMATCH" };
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
  return { ok: true, items };
}

export function createMealBuildQueueState(
  items: readonly ContextualBuildQueueItem[],
): MealBuildQueueState | null {
  return createContextualTargetQueueState(MEAL_BUILD_ORCHESTRATION_VERSION, items);
}

export function readMealBuildQueue(
  value: unknown,
):
  | { ok: true; queue: MealBuildQueueState }
  | { ok: false; reason: "BUILD_QUEUE_PERSISTENCE_GAP" } {
  const catalog = mealLexicalQueueCatalog();
  if (!catalog.ok) {
    return { ok: false, reason: "BUILD_QUEUE_PERSISTENCE_GAP" };
  }
  const read = readContextualTargetQueue({
    value,
    expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
    catalog: catalog.catalog,
    gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
  });
  return read.ok
    ? { ok: true, queue: read.queue }
    : { ok: false, reason: "BUILD_QUEUE_PERSISTENCE_GAP" };
}

export function currentBuildQueueItem(
  queue: MealBuildQueueState,
): ContextualBuildQueueItem | null {
  return currentQueueItem(queue);
}

export function markBuildQueueItemCompleted(
  queue: MealBuildQueueState,
  target: LexemeSenseRef,
):
  | { ok: true; queue: MealBuildQueueState }
  | { ok: false; reason: "BUILD_TARGET_IDENTITY_MISMATCH" } {
  const marked = markQueueItemCompleted(queue, target);
  if (!marked.ok) {
    return { ok: false, reason: "BUILD_TARGET_IDENTITY_MISMATCH" };
  }
  return marked;
}

export function buildHandoffLabel(count: number): string {
  return queueHandoffLabel("BUILD", count);
}
