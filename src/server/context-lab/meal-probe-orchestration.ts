import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import type {
  ContextualProbeDisposition,
  ContextualProbeRoutingResult,
  ContextualProbeSkill,
  ContextualProbeTarget,
  ProbeObservationRef,
} from "@/contextual-learning/candidate-v0/probe/types";
import { resolveProbeDisposition } from "@/contextual-learning/candidate-v0/probe/resolve-probe-disposition";
import { BUNDLED_SPOON_LEXEME_ID } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";

export type MealProbePhase =
  | "PROBE_NOT_STARTED"
  | "PROBE_INTRO"
  | "PROBE_TASK_ISSUED"
  | "PROBE_FEEDBACK_RECORDED"
  | "PROBE_COMPLETED"
  | "ROUTING_SUMMARY"
  | "BUILD_HANDOFF";

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

export function spoonPendingMessage(
  results: readonly ContextualProbeRoutingResult[],
): string | null {
  const spoon = results.find((result) => result.target.lexemeId === BUNDLED_SPOON_LEXEME_ID);
  if (!spoon) {
    return "勺子的下一步还需要更多信息。";
  }
  if (spoon.disposition === "BUILD") {
    return null;
  }
  if (spoon.disposition === "STRENGTHEN") {
    return "勺子的强化体验将在下一步实现。";
  }
  if (spoon.disposition === "READY") {
    return "这次勺子已经能独立回答，不进入教学阶段。";
  }
  return "还不能确定勺子的下一步，不会默认进入教学。";
}
