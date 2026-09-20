import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import type {
  ContextualProbeDisposition,
  ContextualProbeRoutingResult,
  ContextualProbeSkill,
  ContextualProbeTarget,
  ProbeObservationRef,
} from "@/contextual-learning/candidate-v0/probe/types";
import { resolveProbeDisposition } from "@/contextual-learning/candidate-v0/probe/resolve-probe-disposition";
import { isActiveRecallStrengthenEligible } from "@/contextual-learning/candidate-v0/strengthen/eligibility";
import {
  buildMealStrengthenQueue,
  createMealStrengthenQueueState,
  readMealStrengthenQueue,
  type MealStrengthenQueueState,
} from "@/contextual-learning/candidate-v0/strengthen/queue";
import type { ContextualSupportExposure } from "@/contextual-learning/candidate-v0/strengthen/types";
import { BUNDLED_SPOON_LEXEME_ID } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";

export type MealProbePhase =
  | "PROBE_NOT_STARTED"
  | "PROBE_INTRO"
  | "PROBE_TASK_ISSUED"
  | "PROBE_FEEDBACK_RECORDED"
  | "PROBE_COMPLETED"
  | "ROUTING_SUMMARY"
  | "BUILD_HANDOFF"
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

export function canHandoffSpoonBuild(
  results: readonly ContextualProbeRoutingResult[],
): boolean {
  return results.some(
    (result) =>
      result.target.lexemeId === BUNDLED_SPOON_LEXEME_ID &&
      result.disposition === "BUILD",
  );
}

export function strengthenQueueFromProbe(
  probe: MealProbeOrchestration,
): ContextualStrengthenQueueItems {
  return buildMealStrengthenQueue({
    targets: probe.targets,
    results: routingResultsForProbe(probe),
  });
}

type ContextualStrengthenQueueItems = ReturnType<typeof buildMealStrengthenQueue>;

export function canHandoffRecallStrengthen(probe: MealProbeOrchestration): boolean {
  return strengthenQueueFromProbe(probe).length > 0;
}

export function initializeStrengthenQueue(
  probe: MealProbeOrchestration,
): MealStrengthenQueueState | null {
  return createMealStrengthenQueueState(strengthenQueueFromProbe(probe));
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

export function capabilityNoteForResult(input: {
  result: ContextualProbeRoutingResult;
}): string | null {
  if (
    input.result.disposition === "BUILD" &&
    input.result.target.lexemeId !== BUNDLED_SPOON_LEXEME_ID
  ) {
    return "建立记忆体验尚未实现";
  }
  return null;
}

export function probePendingMessage(
  results: readonly ContextualProbeRoutingResult[],
): string | null {
  const hasStrengthen = results.some(
    (result) =>
      isActiveRecallStrengthenEligible({
        target: result.target,
        disposition: result.disposition,
        observations: result.observations,
      }),
  );
  const hasSpoonBuild = canHandoffSpoonBuild(results);
  if (hasStrengthen || hasSpoonBuild) {
    return null;
  }
  if (results.every((result) => result.disposition === "READY")) {
    return null;
  }
  return "还不能确定下一步，不会默认进入教学。";
}
