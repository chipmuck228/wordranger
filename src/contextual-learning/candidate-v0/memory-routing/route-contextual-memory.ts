/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Pure frozen-need → BUILD/STRENGTHEN/UNRESOLVED router.
 * Does not write snapshots, tasks, or Evidence.
 */

import type { LearningNeedReason } from "@/domain/learning/learning-need";
import type { WeaknessType } from "@/domain/learning/weakness.types";
import type { LexemeSenseRef } from "../domain/types";
import type {
  ContextualMemoryRoutingDecision,
  ContextualMemoryRoutingInput,
  ContextualMemoryRoutingReason,
  FrozenLearningNeedSignal,
  RoutingProvenance,
} from "./types";

const KNOWN_REASONS: ReadonlySet<LearningNeedReason> = new Set([
  "NEW_WORD",
  "WEAKNESS",
  "REVIEW_DUE",
  "STAGE_PROGRESS",
  "FADING",
  "USER_MARKED",
]);

const STRENGTHEN_REASONS: ReadonlySet<LearningNeedReason> = new Set([
  "REVIEW_DUE",
  "WEAKNESS",
]);

const WEAKNESS_REASON_BY_TYPE: Partial<
  Record<WeaknessType, ContextualMemoryRoutingReason>
> = {
  ACTIVE_RECALL: "FROZEN_WEAKNESS_ACTIVE_RECALL",
  SPELLING: "FROZEN_WEAKNESS_SPELLING",
  CONFUSION: "FROZEN_WEAKNESS_CONFUSION",
  HINT_DEPENDENCY: "FROZEN_WEAKNESS_HINT_DEPENDENCY",
};

export function routeContextualMemory(
  input: ContextualMemoryRoutingInput,
): ContextualMemoryRoutingDecision {
  const target = copyTarget(input.target);
  const supportingReasons = [...(input.learningNeed.supportingReasons ?? [])];
  const provenanceBase = (
    ruleId: string,
    extras: Partial<RoutingProvenance> = {},
  ): RoutingProvenance => ({
    source: "FROZEN_LEARNING_NEED",
    needReason: input.learningNeed.reason,
    supportingReasons,
    weaknessType: input.learningNeed.weaknessFocus?.type,
    ruleId,
    ...extras,
  });

  if (!target.lexemeId.trim() || !target.senseId.trim()) {
    return {
      status: "UNRESOLVED",
      target,
      reason: "MEMORY_ROUTING_UNMAPPED_SENSE",
      provenance: provenanceBase("MEMORY_ROUTING_UNMAPPED_SENSE"),
    };
  }

  if (
    input.learningNeed.lexemeId.trim() &&
    input.learningNeed.lexemeId !== target.lexemeId
  ) {
    return {
      status: "UNRESOLVED",
      target,
      reason: "MEMORY_ROUTING_CONFLICTING_SIGNALS",
      provenance: provenanceBase("MEMORY_ROUTING_NEED_TARGET_MISMATCH"),
    };
  }

  const primary = input.learningNeed.reason;
  if (!isKnownReason(primary)) {
    return {
      status: "UNRESOLVED",
      target,
      reason: "MEMORY_ROUTING_UNKNOWN_NEED_REASON",
      provenance: provenanceBase("MEMORY_ROUTING_UNKNOWN_NEED_REASON"),
    };
  }

  const allReasons = [primary, ...supportingReasons];
  if (allReasons.some((reason) => !isKnownReason(reason))) {
    return {
      status: "UNRESOLVED",
      target,
      reason: "MEMORY_ROUTING_UNKNOWN_NEED_REASON",
      provenance: provenanceBase("MEMORY_ROUTING_UNKNOWN_SUPPORTING_REASON"),
    };
  }

  const claimsFirstLearn = allReasons.includes("NEW_WORD");
  const claimsStrengthen = allReasons.some((reason) =>
    STRENGTHEN_REASONS.has(reason),
  );

  if (claimsFirstLearn && claimsStrengthen) {
    return {
      status: "UNRESOLVED",
      target,
      reason: "MEMORY_ROUTING_CONFLICTING_SIGNALS",
      provenance: provenanceBase("MEMORY_ROUTING_CONFLICTING_SIGNALS"),
    };
  }

  if (claimsFirstLearn) {
    return {
      status: "UNRESOLVED",
      target,
      reason: "MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL",
      provenance: provenanceBase("INSUFFICIENT_FROZEN_SIGNAL_FOR_BUILD"),
    };
  }

  if (primary === "REVIEW_DUE") {
    return {
      status: "RESOLVED",
      intent: "STRENGTHEN",
      target,
      reason: "FROZEN_REVIEW_DUE",
      provenance: provenanceBase("FROZEN_REVIEW_DUE"),
    };
  }

  if (primary === "WEAKNESS") {
    return routeWeakness(input.learningNeed, target, provenanceBase);
  }

  return {
    status: "UNRESOLVED",
    target,
    reason: "MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL",
    provenance: provenanceBase("MEMORY_ROUTING_UNMAPPED_NEED_REASON"),
  };
}

function routeWeakness(
  learningNeed: FrozenLearningNeedSignal,
  target: LexemeSenseRef,
  provenanceBase: (ruleId: string, extras?: Partial<RoutingProvenance>) => RoutingProvenance,
): ContextualMemoryRoutingDecision {
  const focus = learningNeed.weaknessFocus;
  if (!focus) {
    return {
      status: "UNRESOLVED",
      target,
      reason: "MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL",
      provenance: provenanceBase("MEMORY_ROUTING_WEAKNESS_WITHOUT_FOCUS"),
    };
  }

  const reason = WEAKNESS_REASON_BY_TYPE[focus.type] ?? "FROZEN_WEAKNESS_OTHER";
  return {
    status: "RESOLVED",
    intent: "STRENGTHEN",
    target,
    reason,
    provenance: provenanceBase(reason, { weaknessType: focus.type }),
  };
}

function isKnownReason(reason: string): reason is LearningNeedReason {
  return KNOWN_REASONS.has(reason as LearningNeedReason);
}

function copyTarget(target: LexemeSenseRef): LexemeSenseRef {
  return { lexemeId: target.lexemeId, senseId: target.senseId };
}
