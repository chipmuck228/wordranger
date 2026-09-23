import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import type {
  ContextualProbeDisposition,
  ContextualProbeRoutingResult,
  ContextualProbeSkill,
  ContextualProbeTarget,
  ProbeObservationRef,
} from "@/contextual-learning/candidate-v0/probe/types";
import { resolveProbeDisposition } from "@/contextual-learning/candidate-v0/probe/resolve-probe-disposition";
import { isActiveRecallBuildEligible } from "@/contextual-learning/candidate-v0/build/eligibility";
import {
  buildHandoffLabel,
  buildMealBuildQueue,
  createMealBuildQueueState,
  currentBuildQueueItem,
  readMealBuildQueue,
  type MealBuildQueueState,
} from "@/contextual-learning/candidate-v0/build/queue";
import { isActiveRecallStrengthenEligible } from "@/contextual-learning/candidate-v0/strengthen/eligibility";
import {
  buildMealStrengthenQueue,
  createMealStrengthenQueueState,
  currentStrengthenQueueItem,
  readMealStrengthenQueue,
  strengthenHandoffLabel,
  type MealStrengthenQueueState,
} from "@/contextual-learning/candidate-v0/strengthen/queue";
import type { ContextualSupportExposure } from "@/contextual-learning/candidate-v0/strengthen/types";

export type MealProbePhase =
  | "PROBE_NOT_STARTED"
  | "PROBE_INTRO"
  | "PROBE_TASK_ISSUED"
  | "PROBE_FEEDBACK_RECORDED"
  | "PROBE_COMPLETED"
  | "ROUTING_SUMMARY"
  | "BUILD_HANDOFF"
  | "BUILD_ITEM_RECORDED"
  | "BUILD_QUEUE_COMPLETED"
  | "STRENGTHEN_HANDOFF"
  | "STRENGTHEN_ITEM_RECORDED"
  | "STRENGTHEN_QUEUE_COMPLETED";

export interface MealProbeIssuedTask {
  taskId: string;
  targetLexemeId: string;
  senseId: string;
  skill: ContextualProbeSkill;
  entityId: string;
}

export interface MealProbeOrchestration {
  phase: MealProbePhase;
  targets: ContextualProbeTarget[];
  currentTargetIndex: number;
  currentSkill: ContextualProbeSkill | null;
  issued: MealProbeIssuedTask | null;
  observations: ProbeObservationRef[];
  lastOutcome?: EvidenceOutcome;
  experienceMode?: "BUILD" | "STRENGTHEN" | null;
  supportExposures?: ContextualSupportExposure[];
  strengthenQueue?: MealStrengthenQueueState | null;
  buildQueue?: MealBuildQueueState | null;
}

export function createMealProbeOrchestration(
  targets: ContextualProbeTarget[],
): MealProbeOrchestration {
  return {
    phase: "PROBE_INTRO",
    targets,
    currentTargetIndex: 0,
    currentSkill: null,
    issued: null,
    observations: [],
    experienceMode: null,
    supportExposures: [],
    strengthenQueue: null,
    buildQueue: null,
  };
}

export function nextProbeSkill(
  probe: MealProbeOrchestration,
): { targetIndex: number; skill: ContextualProbeSkill } | "SUMMARY" {
  for (let index = probe.currentTargetIndex; index < probe.targets.length; index += 1) {
    const target = probe.targets[index];
    const observed = probe.observations.filter((item) =>
      item.target.lexemeId === target.target.lexemeId &&
      item.target.senseId === target.target.senseId,
    );
    const recall = observed.find((item) => item.skill === "ACTIVE_RECALL");
    if (!recall) {
      return { targetIndex: index, skill: "ACTIVE_RECALL" };
    }
    if (recall.outcome === EvidenceOutcome.INDEPENDENT_CORRECT) {
      continue;
    }
    const recognition = observed.find((item) => item.skill === "MEANING_RECOGNITION");
    if (!recognition) {
      return { targetIndex: index, skill: "MEANING_RECOGNITION" };
    }
  }
  return "SUMMARY";
}

export function routingResultsForProbe(
  probe: MealProbeOrchestration,
): ContextualProbeRoutingResult[] {
  return probe.targets.map((target) =>
    resolveProbeDisposition({
      target: target.target,
      observations: probe.observations.filter(
        (item) =>
          item.target.lexemeId === target.target.lexemeId &&
          item.target.senseId === target.target.senseId,
      ),
    }),
  );
}

export function strengthenQueueFromProbe(
  probe: MealProbeOrchestration,
): ReturnType<typeof buildMealStrengthenQueue> {
  return buildMealStrengthenQueue({
    targets: probe.targets,
    results: routingResultsForProbe(probe),
  });
}

export function buildQueueFromProbe(
  probe: MealProbeOrchestration,
): ReturnType<typeof buildMealBuildQueue> {
  return buildMealBuildQueue({
    targets: probe.targets,
    results: routingResultsForProbe(probe),
  });
}

export function remainingBuildCount(probe: MealProbeOrchestration): number {
  if (probe.buildQueue) {
    const read = readMealBuildQueue(probe.buildQueue);
    if (!read.ok) {
      return 0;
    }
    return Math.max(0, read.queue.items.length - read.queue.currentIndex);
  }
  const built = buildQueueFromProbe(probe);
  return built.ok ? built.items.length : 0;
}

export function remainingStrengthenCount(probe: MealProbeOrchestration): number {
  if (probe.strengthenQueue) {
    const read = readMealStrengthenQueue(probe.strengthenQueue);
    if (!read.ok) {
      return 0;
    }
    return Math.max(0, read.queue.items.length - read.queue.currentIndex);
  }
  return strengthenQueueFromProbe(probe).length;
}

export function canHandoffRecallBuild(probe: MealProbeOrchestration): boolean {
  return remainingBuildCount(probe) > 0;
}

export function canHandoffRecallStrengthen(probe: MealProbeOrchestration): boolean {
  return remainingStrengthenCount(probe) > 0;
}

export function initializeBuildQueue(
  probe: MealProbeOrchestration,
):
  | { ok: true; queue: MealBuildQueueState }
  | { ok: false; reason: "BUILD_ELIGIBILITY_MISMATCH" | "BUILD_QUEUE_EMPTY" } {
  if (probe.buildQueue) {
    const existing = readMealBuildQueue(probe.buildQueue);
    if (!existing.ok) {
      return { ok: false, reason: "BUILD_QUEUE_EMPTY" };
    }
    if (
      existing.queue.currentIndex > 0 ||
      existing.queue.currentPlanId !== null ||
      existing.queue.completed.length > 0
    ) {
      return { ok: false, reason: "BUILD_QUEUE_EMPTY" };
    }
    return existing;
  }
  const built = buildQueueFromProbe(probe);
  if (!built.ok) {
    return built;
  }
  const queue = createMealBuildQueueState(built.items);
  if (!queue) {
    return { ok: false, reason: "BUILD_QUEUE_EMPTY" };
  }
  return { ok: true, queue };
}

export function initializeStrengthenQueue(
  probe: MealProbeOrchestration,
): MealStrengthenQueueState | null {
  if (probe.strengthenQueue) {
    const existing = readMealStrengthenQueue(probe.strengthenQueue);
    if (!existing.ok) {
      return null;
    }
    if (
      existing.queue.currentIndex > 0 ||
      existing.queue.currentPlanId !== null ||
      existing.queue.completed.length > 0
    ) {
      return null;
    }
    return existing.queue;
  }
  return createMealStrengthenQueueState(strengthenQueueFromProbe(probe));
}

export function requireBuildQueue(
  probe: MealProbeOrchestration,
):
  | { ok: true; queue: MealBuildQueueState }
  | { ok: false; reason: "BUILD_QUEUE_PERSISTENCE_GAP" } {
  return readMealBuildQueue(probe.buildQueue);
}

export function requireStrengthenQueue(
  probe: MealProbeOrchestration,
):
  | { ok: true; queue: MealStrengthenQueueState }
  | { ok: false; reason: "STRENGTHEN_QUEUE_PERSISTENCE_GAP" } {
  return readMealStrengthenQueue(probe.strengthenQueue);
}

export function publicDispositionLabel(
  disposition: ContextualProbeDisposition,
): string {
  switch (disposition) {
    case "BUILD":
      return "建立情境记忆";
    case "STRENGTHEN":
      return "加强记忆连接";
    case "READY":
      return "本次已能独立回答";
    case "UNRESOLVED":
      return "还需要更多信息";
  }
}

export function capabilityNoteForResult(): string | null {
  return null;
}

export function probePendingMessage(
  results: readonly ContextualProbeRoutingResult[],
): string | null {
  const hasStrengthen = results.some((result) =>
    isActiveRecallStrengthenEligible({
      target: result.target,
      disposition: result.disposition,
      observations: result.observations,
    }),
  );
  const hasBuild = results.some((result) =>
    isActiveRecallBuildEligible({
      target: result.target,
      disposition: result.disposition,
      observations: result.observations,
    }),
  );
  if (hasStrengthen || hasBuild) {
    return null;
  }
  if (results.every((result) => result.disposition === "READY")) {
    return null;
  }
  return "还不能确定下一步，不会默认进入教学。";
}

export function buildButtonLabelForProbe(probe: MealProbeOrchestration): string {
  return buildHandoffLabel(remainingBuildCount(probe));
}

export function strengthenButtonLabelForProbe(
  probe: MealProbeOrchestration,
): string {
  return strengthenHandoffLabel(remainingStrengthenCount(probe));
}

export function queueHasCurrentItem(
  kind: "BUILD" | "STRENGTHEN",
  probe: MealProbeOrchestration,
): boolean {
  if (kind === "BUILD") {
    const queue = requireBuildQueue(probe);
    return queue.ok && currentBuildQueueItem(queue.queue) !== null;
  }
  const queue = requireStrengthenQueue(probe);
  return queue.ok && currentStrengthenQueueItem(queue.queue) !== null;
}
