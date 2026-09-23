/**
 * Fail-closed queue / ExperienceRun alignment.
 * Candidate V0 / Experimental / Not a Standard.
 *
 * This is a mutation invariant, not a presentation-only guard.
 */

import {
  readMealBuildQueue,
  type MealBuildQueueState,
} from "@/contextual-learning/candidate-v0/build/queue";
import {
  readMealStrengthenQueue,
  type MealStrengthenQueueState,
} from "@/contextual-learning/candidate-v0/strengthen/queue";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution/types";
import type { MealProbeOrchestration } from "./meal-probe-orchestration";

export type ExperienceQueueValidation =
  | { ok: true }
  | { ok: false; reason: string };

type InspectedQueue =
  | { present: false }
  | { present: true; ok: false; reason: string }
  | {
      present: true;
      ok: true;
      queue: MealBuildQueueState | MealStrengthenQueueState;
    };

export function validateActiveExperienceQueue(input: {
  probe: MealProbeOrchestration | null;
  experienceRun: Pick<ExperienceRun, "planSnapshot">;
}): ExperienceQueueValidation {
  if (!input.probe) {
    return { ok: true };
  }
  const planId = input.experienceRun.planSnapshot.plan.id;
  const build = inspectBuildQueue(input.probe.buildQueue);
  const strengthen = inspectStrengthenQueue(input.probe.strengthenQueue);
  if (build.present && !build.ok) {
    return { ok: false, reason: build.reason };
  }
  if (strengthen.present && !strengthen.ok) {
    return { ok: false, reason: strengthen.reason };
  }

  switch (input.probe.phase) {
    case "BUILD_HANDOFF":
      return requireActiveHandoff({
        kind: "BUILD",
        queue: build,
        planId,
        other: strengthen,
      });
    case "STRENGTHEN_HANDOFF":
      return requireActiveHandoff({
        kind: "STRENGTHEN",
        queue: strengthen,
        planId,
        other: build,
      });
    case "BUILD_ITEM_RECORDED":
      return requireRecordedBetweenItems("BUILD", build);
    case "STRENGTHEN_ITEM_RECORDED":
      return requireRecordedBetweenItems("STRENGTHEN", strengthen);
    case "BUILD_QUEUE_COMPLETED":
      return requireCompletedQueue("BUILD", build);
    case "STRENGTHEN_QUEUE_COMPLETED":
      return requireCompletedQueue("STRENGTHEN", strengthen);
    case "ROUTING_SUMMARY":
    case "PROBE_COMPLETED":
    case "PROBE_INTRO":
    case "PROBE_NOT_STARTED":
    case "PROBE_TASK_ISSUED":
    case "PROBE_FEEDBACK_RECORDED":
      return requireNoActivePlanId(build, strengthen);
    default:
      return { ok: false, reason: "UNKNOWN_PROBE_PHASE" };
  }
}

function inspectBuildQueue(value: unknown): InspectedQueue {
  if (value == null) {
    return { present: false };
  }
  const read = readMealBuildQueue(value);
  return read.ok
    ? { present: true, ok: true, queue: read.queue }
    : { present: true, ok: false, reason: read.reason };
}

function inspectStrengthenQueue(value: unknown): InspectedQueue {
  if (value == null) {
    return { present: false };
  }
  const read = readMealStrengthenQueue(value);
  return read.ok
    ? { present: true, ok: true, queue: read.queue }
    : { present: true, ok: false, reason: read.reason };
}

function requireActiveHandoff(input: {
  kind: "BUILD" | "STRENGTHEN";
  queue: InspectedQueue;
  planId: string;
  other: InspectedQueue;
}): ExperienceQueueValidation {
  if (!input.queue.present || !input.queue.ok) {
    return {
      ok: false,
      reason:
        input.kind === "BUILD"
          ? "BUILD_QUEUE_PERSISTENCE_GAP"
          : "STRENGTHEN_QUEUE_PERSISTENCE_GAP",
    };
  }
  if (input.queue.queue.currentPlanId !== input.planId) {
    return {
      ok: false,
      reason:
        input.kind === "BUILD"
          ? "BUILD_QUEUE_PLAN_MISMATCH"
          : "STRENGTHEN_QUEUE_PLAN_MISMATCH",
    };
  }
  if (!input.queue.queue.items[input.queue.queue.currentIndex]) {
    return {
      ok: false,
      reason:
        input.kind === "BUILD"
          ? "BUILD_QUEUE_PHASE_INVARIANT"
          : "STRENGTHEN_QUEUE_PHASE_INVARIANT",
    };
  }
  if (input.other.present && input.other.ok && input.other.queue.currentPlanId !== null) {
    return { ok: false, reason: "ACTIVE_PLAN_ID_NOT_ALLOWED" };
  }
  return { ok: true };
}

function requireRecordedBetweenItems(
  kind: "BUILD" | "STRENGTHEN",
  queue: InspectedQueue,
): ExperienceQueueValidation {
  if (!queue.present || !queue.ok) {
    return {
      ok: false,
      reason:
        kind === "BUILD"
          ? "BUILD_QUEUE_PERSISTENCE_GAP"
          : "STRENGTHEN_QUEUE_PERSISTENCE_GAP",
    };
  }
  if (queue.queue.currentPlanId !== null || !queue.queue.items[queue.queue.currentIndex]) {
    return {
      ok: false,
      reason:
        kind === "BUILD"
          ? "BUILD_QUEUE_PHASE_INVARIANT"
          : "STRENGTHEN_QUEUE_PHASE_INVARIANT",
    };
  }
  return { ok: true };
}

function requireCompletedQueue(
  kind: "BUILD" | "STRENGTHEN",
  queue: InspectedQueue,
): ExperienceQueueValidation {
  if (!queue.present || !queue.ok) {
    return {
      ok: false,
      reason:
        kind === "BUILD"
          ? "BUILD_QUEUE_PERSISTENCE_GAP"
          : "STRENGTHEN_QUEUE_PERSISTENCE_GAP",
    };
  }
  if (
    queue.queue.currentPlanId !== null ||
    queue.queue.currentIndex !== queue.queue.items.length
  ) {
    return {
      ok: false,
      reason:
        kind === "BUILD"
          ? "BUILD_QUEUE_PHASE_INVARIANT"
          : "STRENGTHEN_QUEUE_PHASE_INVARIANT",
    };
  }
  return { ok: true };
}

function requireNoActivePlanId(
  build: InspectedQueue,
  strengthen: InspectedQueue,
): ExperienceQueueValidation {
  if (build.present && build.ok && build.queue.currentPlanId !== null) {
    return { ok: false, reason: "ACTIVE_PLAN_ID_NOT_ALLOWED" };
  }
  if (
    strengthen.present &&
    strengthen.ok &&
    strengthen.queue.currentPlanId !== null
  ) {
    return { ok: false, reason: "ACTIVE_PLAN_ID_NOT_ALLOWED" };
  }
  return { ok: true };
}
