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
import {
  createContextualTargetQueueState,
  currentQueueItem,
  markQueueItemCompleted,
  queueHandoffLabel,
  readContextualTargetQueue,
  type ContextualTargetQueueState,
} from "../queue/target-queue";
import { mealLexicalQueueCatalog } from "../build/meal-lexical-build-profiles";
import { isActiveRecallStrengthenEligible } from "./eligibility";
import {
  MEAL_STRENGTHEN_ORCHESTRATION_VERSION,
  type ContextualStrengthenQueueItem,
} from "./types";

export type MealStrengthenQueueState =
  ContextualTargetQueueState<typeof MEAL_STRENGTHEN_ORCHESTRATION_VERSION>;

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
  return createContextualTargetQueueState(
    MEAL_STRENGTHEN_ORCHESTRATION_VERSION,
    items,
  );
}

export function readMealStrengthenQueue(
  value: unknown,
):
  | { ok: true; queue: MealStrengthenQueueState }
  | { ok: false; reason: "STRENGTHEN_QUEUE_PERSISTENCE_GAP" } {
  const catalog = mealLexicalQueueCatalog();
  if (!catalog.ok) {
    return { ok: false, reason: "STRENGTHEN_QUEUE_PERSISTENCE_GAP" };
  }
  const read = readContextualTargetQueue({
    value,
    expectedVersion: MEAL_STRENGTHEN_ORCHESTRATION_VERSION,
    catalog: catalog.catalog,
    gapReason: "STRENGTHEN_QUEUE_PERSISTENCE_GAP",
  });
  return read.ok
    ? { ok: true, queue: read.queue }
    : { ok: false, reason: "STRENGTHEN_QUEUE_PERSISTENCE_GAP" };
}

export function currentStrengthenQueueItem(
  queue: MealStrengthenQueueState,
): ContextualStrengthenQueueItem | null {
  return currentQueueItem(queue);
}

export function markStrengthenQueueItemCompleted(
  queue: MealStrengthenQueueState,
  target: LexemeSenseRef,
):
  | { ok: true; queue: MealStrengthenQueueState }
  | { ok: false; reason: "STRENGTHEN_TARGET_IDENTITY_MISMATCH" } {
  const marked = markQueueItemCompleted(queue, target);
  if (!marked.ok) {
    return { ok: false, reason: "STRENGTHEN_TARGET_IDENTITY_MISMATCH" };
  }
  return marked;
}

export function strengthenHandoffLabel(count: number): string {
  return queueHandoffLabel("STRENGTHEN", count);
}
