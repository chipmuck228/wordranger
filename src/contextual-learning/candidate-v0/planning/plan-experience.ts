/**
 * Candidate V0 / Experimental / Not a Standard.
 * Deterministic selection of a reviewed LearningExperiencePlan.
 * Does not infer CognitiveMode or learner state.
 */

import { findSemanticProjection } from "../compilation/semantic-projection";
import { cloneValue } from "../execution/clone";
import { classifyExperienceStep } from "../execution/classify-step";
import { createExperienceRun } from "../execution/create-experience-run";
import { groundGuidedPresentation } from "../execution/ground-guided-presentation";
import { findProfile, sameLexemeSense } from "../domain/lexeme-sense";
import type {
  CognitiveMode,
  ExperienceTarget,
  LearningExperiencePlan,
  LexemeSenseRef,
  ResolvedTargetSnapshot,
  RuntimeCapability,
} from "../domain/types";
import {
  isAssessableExperienceStep,
  isGuidedExperienceStep,
} from "../domain/types";
import { resolveContextSnapshot } from "../validation/resolve-context";
import { validateContextFrame } from "../validation/validate-context-frame";
import {
  findCapability,
  validateExperiencePlan,
} from "../validation/validate-experience-plan";
import { validateSemanticSkeleton } from "../validation/validate-semantic-skeleton";
import { PlanningErrorCode, planningError } from "./errors";
import { matchRequestedTargetsToPlan } from "./match-targets";
import {
  comparePlanVariants,
  findPlannerFrame,
  findPlannerSkeleton,
  listPlanVariants,
  PLANNER_SENSE_PROFILES,
  PLANNER_SUPPORT_BLOCKS,
  registeredPlannerSenses,
} from "./plan-variant-registry";
import type { MealRuntimeContextId } from "./meal-runtime-context";
import type {
  ExperiencePlanVariant,
  ExperiencePlanningInput,
  ExperiencePlanningResult,
  ExperiencePlanningTrace,
  PlanExecutability,
  RejectedTargetRequirement,
} from "./types";

function runtimeContextOf(
  value?: MealRuntimeContextId,
): MealRuntimeContextId {
  return value ?? "MEAL_BASE";
}

const MODES_REQUIRE_ASSESSABLE_VERIFICATION: readonly CognitiveMode[] = [
  "PROBE",
  "BUILD",
  "STRENGTHEN",
  "RETRIEVE",
];

export interface PlanExperienceOptions {
  variants?: readonly ExperiencePlanVariant[];
}

export function planExperience(
  input: ExperiencePlanningInput,
  options: PlanExperienceOptions = {},
): ExperiencePlanningResult {
  const variants = options.variants ?? listPlanVariants();
  const availableCapabilityIds = uniqueSorted(
    input.runtimeCapabilities.map((capability) => capability.id),
  );
  const requestedTargetIdentities = (input.targets ?? []).map((target) => ({
    lexemeId: target.sense?.lexemeId ?? "",
    senseId: target.sense?.senseId ?? "",
  }));
  const trace = emptyTrace(input.mode, requestedTargetIdentities, availableCapabilityIds);

  const inputError = validatePlannerInput(input, variants);
  if (inputError) {
    return { ok: false, error: inputError.error, trace: { ...trace, ...inputError.trace } };
  }

  const allowedContextIds = input.allowedContextIds
    ? [...input.allowedContextIds]
    : undefined;
  const matching = variants.filter((variant) =>
    variantMatchesRequest(
      variant,
      input.mode,
      input.targets,
      allowedContextIds,
      runtimeContextOf(input.runtimeContextId),
    ),
  );
  const consideredContextIds = uniqueSorted(
    matching.map((variant) => variant.contextFrameId),
  );
  const consideredVariantIds = [...matching]
    .map((variant) => variant.id)
    .sort((left, right) => left.localeCompare(right));
  trace.consideredContextIds = allowedContextIds
    ? [...allowedContextIds]
    : consideredContextIds;
  trace.consideredVariantIds = consideredVariantIds;

  if (matching.length === 0) {
    return failAfterMatch(input, variants, allowedContextIds, trace);
  }

  const rejected: Array<{ variantId: string; reason: string }> = [];
  const admitted: Array<{
    variant: ExperiencePlanVariant;
    plan: LearningExperiencePlan;
    executability: PlanExecutability;
  }> = [];
  let sawMissingCapability = false;
  let sawGuidedOnly = false;
  let sawUnsupportedAssessable = false;
  let sawInvalid = false;
  let sawTargetMismatch = false;

  const ordered = [...matching].sort((left, right) =>
    comparePlanVariants(left, right, allowedContextIds),
  );
  for (const variant of ordered) {
    const evaluation = evaluateVariant(variant, input);
    if (evaluation.ok) {
      admitted.push({
        variant,
        plan: evaluation.plan,
        executability: evaluation.executability,
      });
      continue;
    }
    rejected.push({ variantId: variant.id, reason: evaluation.reason });
    if (evaluation.rejection) {
      trace.rejectedTargetRequirements.push(evaluation.rejection);
    }
    if (evaluation.code === PlanningErrorCode.PLAN_MISSING_RUNTIME_CAPABILITY) {
      sawMissingCapability = true;
    } else if (evaluation.code === PlanningErrorCode.PLAN_GUIDED_ONLY_CANNOT_VERIFY_MODE) {
      sawGuidedOnly = true;
    } else if (evaluation.code === PlanningErrorCode.PLAN_VARIANT_INVALID) {
      sawInvalid = true;
    } else if (evaluation.code === PlanningErrorCode.PLAN_TARGET_REQUIREMENT_MISMATCH) {
      sawTargetMismatch = true;
    } else {
      sawUnsupportedAssessable = true;
    }
  }
  trace.rejectedVariantReasons = [...rejected].sort((left, right) =>
    left.variantId.localeCompare(right.variantId),
  );
  trace.rejectedTargetRequirements.sort((left, right) =>
    left.variantId.localeCompare(right.variantId) || left.path.localeCompare(right.path),
  );

  if (admitted.length === 0) {
    if (sawTargetMismatch && !sawUnsupportedAssessable && !sawGuidedOnly && !sawMissingCapability) {
      const first = trace.rejectedTargetRequirements[0];
      return {
        ok: false,
        error: planningError(
          PlanningErrorCode.PLAN_TARGET_REQUIREMENT_MISMATCH,
          first
            ? `Requested target ${first.lexemeId}::${first.senseId} ${first.field} is not covered by the plan`
            : "Requested target requirements are not covered by any plan target",
          first?.path ?? "targets",
        ),
        trace,
      };
    }
    if (sawMissingCapability && !sawUnsupportedAssessable && !sawGuidedOnly) {
      return {
        ok: false,
        error: planningError(
          PlanningErrorCode.PLAN_MISSING_RUNTIME_CAPABILITY,
          "No matching variant has every required runtime capability",
          "runtimeCapabilities",
        ),
        trace,
      };
    }
    if (sawGuidedOnly && !sawUnsupportedAssessable) {
      return {
        ok: false,
        error: planningError(
          PlanningErrorCode.PLAN_GUIDED_ONLY_CANNOT_VERIFY_MODE,
          `Guided-only variants cannot verify requested mode ${input.mode}`,
          "mode",
        ),
        trace,
      };
    }
    if (sawGuidedOnly && sawUnsupportedAssessable) {
      return {
        ok: false,
        error: planningError(
          PlanningErrorCode.PLAN_GUIDED_ONLY_CANNOT_VERIFY_MODE,
          `No honestly executable assessable path for mode ${input.mode}; Guided acknowledgement is not verification`,
          "mode",
        ),
        trace,
      };
    }
    if (sawInvalid && !sawUnsupportedAssessable) {
      return {
        ok: false,
        error: planningError(
          PlanningErrorCode.PLAN_VARIANT_INVALID,
          "Matching variants failed Candidate validation or grounding",
          "variant",
        ),
        trace,
      };
    }
    return {
      ok: false,
      error: planningError(
        PlanningErrorCode.PLAN_NO_COMPATIBLE_VARIANT,
        "No registered variant is honestly executable for this request",
        "targets",
      ),
      trace,
    };
  }

  const selected = admitted[0]!;
  trace.selectedVariantId = selected.variant.id;
  trace.requiredCapabilityIds = [...selected.variant.requiredCapabilityIds].sort(
    (left, right) => left.localeCompare(right),
  );
  trace.executability = selected.executability;
  return {
    ok: true,
    plan: selected.plan,
    trace,
  };
}

function validatePlannerInput(
  input: ExperiencePlanningInput,
  variants: readonly ExperiencePlanVariant[],
): { error: ReturnType<typeof planningError>; trace?: Partial<ExperiencePlanningTrace> } | null {
  if (input.memoryRoutingDecision) {
    if (input.memoryRoutingDecision.status === "UNRESOLVED") {
      return {
        error: planningError(
          PlanningErrorCode.PLAN_MEMORY_ROUTING_UNRESOLVED,
          "UNRESOLVED memory routing cannot default to BUILD or STRENGTHEN",
          "memoryRoutingDecision",
        ),
      };
    }
    if (input.memoryRoutingDecision.intent !== input.mode) {
      return {
        error: planningError(
          PlanningErrorCode.PLAN_MEMORY_ROUTING_INTENT_MISMATCH,
          "Planner mode must already equal the resolved routing intent",
          "memoryRoutingDecision",
        ),
      };
    }
  }
  if (!input.learningNeedRef || !input.learningNeedRef.trim()) {
    return {
      error: planningError(
        PlanningErrorCode.PLAN_MISSING_LEARNING_NEED_REF,
        "learningNeedRef is required and is treated as an opaque frozen-need reference",
        "learningNeedRef",
      ),
    };
  }
  if (!input.targets || input.targets.length === 0) {
    return {
      error: planningError(
        PlanningErrorCode.PLAN_NO_TARGETS,
        "At least one explicit target sense is required",
        "targets",
      ),
    };
  }
  const registered = registeredPlannerSensesFrom(variants);
  for (const [index, target] of input.targets.entries()) {
    if (!target.sense?.lexemeId?.trim() || !target.sense.senseId?.trim()) {
      return {
        error: planningError(
          PlanningErrorCode.PLAN_TARGET_NOT_REGISTERED,
          "Every target must declare lexemeId and senseId",
          `targets[${index}]`,
        ),
      };
    }
    if (!registered.some((sense) => sameLexemeSense(sense, target.sense))) {
      return {
        error: planningError(
          PlanningErrorCode.PLAN_TARGET_NOT_REGISTERED,
          `Target ${target.sense.lexemeId}::${target.sense.senseId} is not registered`,
          `targets[${index}].sense`,
        ),
      };
    }
  }
  if (input.allowedContextIds && input.allowedContextIds.length === 0) {
    return {
      error: planningError(
        PlanningErrorCode.PLAN_NO_ALLOWED_CONTEXT,
        "allowedContextIds is an empty hard allow-list",
        "allowedContextIds",
      ),
    };
  }
  if (input.allowedContextIds) {
    const known = new Set(variants.map((variant) => variant.contextFrameId));
    if (!input.allowedContextIds.some((id) => known.has(id))) {
      return {
        error: planningError(
          PlanningErrorCode.PLAN_NO_ALLOWED_CONTEXT,
          "No allowed context id is present in the reviewed variant registry",
          "allowedContextIds",
        ),
      };
    }
  }
  return null;
}

function failAfterMatch(
  input: ExperiencePlanningInput,
  variants: readonly ExperiencePlanVariant[],
  allowedContextIds: string[] | undefined,
  trace: ExperiencePlanningTrace,
): ExperiencePlanningResult {
  const senseMatched = variants.filter((variant) =>
    sensesMatch(variant, input.targets) &&
    contextAllowed(variant, allowedContextIds),
  );
  if (senseMatched.length > 0 && !senseMatched.some((variant) => variant.mode === input.mode)) {
    return {
      ok: false,
      error: planningError(
        PlanningErrorCode.PLAN_MODE_NOT_AVAILABLE,
        `No reviewed variant offers mode ${input.mode} for these targets`,
        "mode",
      ),
      trace,
    };
  }
  if (allowedContextIds && !variants.some((variant) => contextAllowed(variant, allowedContextIds))) {
    return {
      ok: false,
      error: planningError(
        PlanningErrorCode.PLAN_NO_ALLOWED_CONTEXT,
        "No variant uses a context in the allow-list",
        "allowedContextIds",
      ),
      trace,
    };
  }
  return {
    ok: false,
    error: planningError(
      PlanningErrorCode.PLAN_NO_COMPATIBLE_VARIANT,
      "No variant matches the requested mode, targets, and allowed contexts",
      "targets",
    ),
    trace,
  };
}

function variantMatchesRequest(
  variant: ExperiencePlanVariant,
  mode: CognitiveMode,
  targets: ExperienceTarget[],
  allowedContextIds?: readonly string[],
  runtimeContextId: MealRuntimeContextId = "MEAL_BASE",
): boolean {
  return (
    variant.mode === mode &&
    sensesMatch(variant, targets) &&
    contextAllowed(variant, allowedContextIds) &&
    runtimeContextOf(variant.runtimeContextId) === runtimeContextId
  );
}

function sensesMatch(
  variant: ExperiencePlanVariant,
  targets: ExperienceTarget[],
): boolean {
  const requested = targets.map((target) => target.sense);
  const allRequestedSupported = requested.every((sense) =>
    variant.supportedSenses.some((supported) => sameLexemeSense(supported, sense)),
  );
  const allRequiredPresent = variant.requiredSenses.every((required) =>
    requested.some((sense) => sameLexemeSense(sense, required)),
  );
  return allRequestedSupported && allRequiredPresent;
}

function contextAllowed(
  variant: ExperiencePlanVariant,
  allowedContextIds?: readonly string[],
): boolean {
  if (!allowedContextIds) {
    return true;
  }
  return allowedContextIds.includes(variant.contextFrameId);
}

function evaluateVariant(
  variant: ExperiencePlanVariant,
  input: ExperiencePlanningInput,
):
  | { ok: true; plan: LearningExperiencePlan; executability: PlanExecutability }
  | {
      ok: false;
      code: (typeof PlanningErrorCode)[keyof typeof PlanningErrorCode];
      reason: string;
      rejection?: RejectedTargetRequirement;
    } {
  if (variant.reviewStatus !== "REVIEWED") {
    return {
      ok: false,
      code: PlanningErrorCode.PLAN_VARIANT_INVALID,
      reason: "Variant is not REVIEWED",
    };
  }
  const runtimeContextId = runtimeContextOf(variant.runtimeContextId);
  const authored = input.authoredRuntime;
  const frame = authored
    ? authored.frames.find((item) => item.id === variant.contextFrameId)
    : findPlannerFrame(variant.contextFrameId, runtimeContextId);
  const skeleton = authored
    ? authored.skeleton.id === variant.skeletonId
      ? authored.skeleton
      : undefined
    : findPlannerSkeleton(variant.skeletonId, runtimeContextId);
  if (!frame || !skeleton || frame.reviewStatus !== "REVIEWED" || skeleton.reviewStatus !== "REVIEWED") {
    return {
      ok: false,
      code: PlanningErrorCode.PLAN_VARIANT_INVALID,
      reason: "Context or skeleton is missing or not REVIEWED",
    };
  }
  const skeletonIssues = validateSemanticSkeleton(skeleton);
  const frameIssues = validateContextFrame({ frame, skeleton });
  if (!skeletonIssues.ok || !frameIssues.ok) {
    return {
      ok: false,
      code: PlanningErrorCode.PLAN_VARIANT_INVALID,
      reason: "Skeleton or frame failed Candidate review validation",
    };
  }

  const plan = cloneValue(
    variant.createPlan({
      targets: input.targets,
      loadLexeme: input.loadLexeme,
      runtimeContextId,
      authoredRuntime: authored,
    }),
  );
  plan.sourceLearningNeedRef = input.learningNeedRef.trim();
  const targetMatch = matchRequestedTargetsToPlan({
    variantId: variant.id,
    requested: input.targets,
    planTargets: plan.targets,
  });
  if (!targetMatch.ok) {
    const { rejection } = targetMatch;
    return {
      ok: false,
      code: PlanningErrorCode.PLAN_TARGET_REQUIREMENT_MISMATCH,
      reason: `Target requirement mismatch at ${rejection.path}: requested ${JSON.stringify(rejection.requested)} available ${JSON.stringify(rejection.available)}`,
      rejection,
    };
  }
  const capabilities = uniqueCapabilities(input.runtimeCapabilities);
  const availableIds = new Set(capabilities.map((capability) => capability.id));
  const missingDeclared = variant.requiredCapabilityIds.filter((id) => !availableIds.has(id));

  const resolvedContext = resolveContextSnapshot(frame, skeleton, plan.activeGoalId);
  const resolvedTargets = resolvePlannerTargets(plan);
  const stepClasses = plan.steps.map((step) =>
    classifyExperienceStep({
      step,
      resolvedTargets: resolvedTargets.filter((target) =>
        step.targetIds.includes(target.targetId),
      ),
    }),
  );
  const hasUnsupportedAssessable = plan.steps.some(
    (step, index) =>
      isAssessableExperienceStep(step) && stepClasses[index]?.kind === "UNSUPPORTED",
  );
  if (hasUnsupportedAssessable) {
    return {
      ok: false,
      code: PlanningErrorCode.PLAN_NO_COMPATIBLE_VARIANT,
      reason: "Assessable step has no honest frozen semantic projection",
    };
  }

  const guidedOnly =
    variant.containsGuidedSteps &&
    !variant.containsAssessableSteps &&
    plan.steps.every((step) => isGuidedExperienceStep(step));
  if (
    guidedOnly &&
    MODES_REQUIRE_ASSESSABLE_VERIFICATION.includes(input.mode)
  ) {
    return {
      ok: false,
      code: PlanningErrorCode.PLAN_GUIDED_ONLY_CANNOT_VERIFY_MODE,
      reason: "GUIDED_ONLY cannot verify the requested cognitive mode",
    };
  }

  if (missingDeclared.length > 0) {
    return {
      ok: false,
      code: PlanningErrorCode.PLAN_MISSING_RUNTIME_CAPABILITY,
      reason: `Missing capability ${missingDeclared[0]}`,
    };
  }

  for (const step of plan.steps) {
    if (!isAssessableExperienceStep(step)) {
      continue;
    }
    const stepTargets = resolvedTargets.filter((item) =>
      step.targetIds.includes(item.targetId),
    );
    const target = stepTargets[0];
    const projection = findSemanticProjection({
      semanticAction: step.semanticAction,
      responseKind: step.expectedResponse.kind,
      targetFocus: target?.focus ?? "MEANING_TO_FORM",
      stepPurpose: step.purpose,
    });
    if (!projection) {
      return {
        ok: false,
        code: PlanningErrorCode.PLAN_NO_COMPATIBLE_VARIANT,
        reason: `No semantic projection for ${step.id}`,
      };
    }
    if (
      !findCapability(capabilities, step.semanticAction, step.expectedResponse.kind)
    ) {
      return {
        ok: false,
        code: PlanningErrorCode.PLAN_MISSING_RUNTIME_CAPABILITY,
        reason: `No runtime capability for ${step.semanticAction}/${step.expectedResponse.kind}`,
      };
    }
  }

  for (const step of plan.steps) {
    if (!isGuidedExperienceStep(step)) {
      continue;
    }
    const grounding = groundGuidedPresentation({
      presentation: step.presentation,
      resolvedContext,
    });
    if (!grounding.ok) {
      return {
        ok: false,
        code: PlanningErrorCode.PLAN_VARIANT_INVALID,
        reason: grounding.error.message,
      };
    }
  }

  const validated = validateExperiencePlan({
    plan,
    frame,
    skeleton,
    capabilities,
    supportBlocks: PLANNER_SUPPORT_BLOCKS,
    senseProfiles: PLANNER_SENSE_PROFILES,
  });
  if (!validated.ok) {
    const missingCap = validated.issues.some(
      (issue) => issue.code === "EXP_NO_RUNTIME_CAPABILITY",
    );
    return {
      ok: false,
      code: missingCap
        ? PlanningErrorCode.PLAN_MISSING_RUNTIME_CAPABILITY
        : PlanningErrorCode.PLAN_VARIANT_INVALID,
      reason: validated.issues[0]?.message ?? "Plan validation failed",
    };
  }

  const created = createExperienceRun({
    plan,
    resolvedContext,
    resolvedTargets,
    createId: () => `plan-check:${variant.id}`,
  });
  if (!created.ok) {
    return {
      ok: false,
      code: PlanningErrorCode.PLAN_VARIANT_INVALID,
      reason: created.error.message,
    };
  }

  return {
    ok: true,
    plan: cloneValue(plan),
    executability: "FULLY_EXECUTABLE",
  };
}

function resolvePlannerTargets(plan: LearningExperiencePlan): ResolvedTargetSnapshot[] {
  return plan.targets.map((target) => ({
    targetId: target.id,
    sense: target.sense,
    displayForm: findProfile(PLANNER_SENSE_PROFILES, target.sense)?.displayForm ?? "",
    focus: target.focus,
  }));
}

function uniqueCapabilities(
  capabilities: readonly RuntimeCapability[],
): RuntimeCapability[] {
  const byId = new Map<string, RuntimeCapability>();
  for (const capability of [...capabilities].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (!byId.has(capability.id)) {
      byId.set(capability.id, capability);
    }
  }
  return [...byId.values()];
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function emptyTrace(
  mode: CognitiveMode,
  requestedTargetIdentities: Array<{ lexemeId: string; senseId: string }>,
  availableCapabilityIds: string[],
): ExperiencePlanningTrace {
  return {
    requestedMode: mode,
    requestedTargetIdentities,
    consideredContextIds: [],
    consideredVariantIds: [],
    rejectedVariantReasons: [],
    rejectedTargetRequirements: [],
    requiredCapabilityIds: [],
    availableCapabilityIds,
  };
}

function registeredPlannerSensesFrom(
  variants: readonly ExperiencePlanVariant[],
): LexemeSenseRef[] {
  if (variants === listPlanVariants()) {
    return [...registeredPlannerSenses()];
  }
  const seen = new Map<string, LexemeSenseRef>();
  for (const variant of variants) {
    for (const sense of variant.supportedSenses) {
      seen.set(`${sense.lexemeId}::${sense.senseId}`, sense);
    }
  }
  return [...seen.values()];
}
