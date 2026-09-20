import "server-only";

/**
 * Server-only Meal BUILD Context Lab preparation.
 * Plans, validates, and issues Candidate steps, then strips answer keys.
 */

import type { PublicGuidedActivity } from "@/contextual-learning/candidate-v0/execution/guided-activity";
import { FROZEN_RUNTIME_CAPABILITIES } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { findProfile } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import type {
  ExperienceTarget,
  LearningExperiencePlan,
  ResolvedContextSnapshot,
  ResolvedTargetSnapshot,
  RuntimeCapability,
} from "@/contextual-learning/candidate-v0/domain/types";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  createExperienceRun,
  issueCurrentStep,
  recordGuidedActivityCompletion,
} from "@/contextual-learning/candidate-v0/execution";
import { ExecutionErrorCode } from "@/contextual-learning/candidate-v0/execution/errors";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution/types";
import {
  planExperience,
  type ExperiencePlanningInput,
} from "@/contextual-learning/candidate-v0/planning";
import {
  findPlannerFrame,
  findPlannerSkeleton,
  PLANNER_SENSE_PROFILES,
  PLANNER_SUPPORT_BLOCKS,
} from "@/contextual-learning/candidate-v0/planning/plan-variant-registry";
import { resolveContextSnapshot } from "@/contextual-learning/candidate-v0/validation/resolve-context";
import { validateExperiencePlan } from "@/contextual-learning/candidate-v0/validation/validate-experience-plan";
import type {
  ContextLabErrorCode,
  ContextLabPilotPayload,
  ContextLabProgress,
  ContextLabScreen,
  PublicContextPresentation,
} from "@/components/context-lab/types";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import {
  contrastCaptionFor,
  frozenPreviewInstruction,
  guidedInstructionFor,
  HOME_BREAKFAST_FRAME_ID,
  HOME_BREAKFAST_SCENE_ENTITY_IDS,
  homeBreakfastFrameCopy,
  mappedMealEntity,
  relationCaptionFor,
} from "./meal-presentation-map";

const TYPING_CAPABILITY = FROZEN_RUNTIME_CAPABILITIES.find(
  (capability) => capability.id === "frozen-text-input:TYPE",
);

const LEARNER_ERROR_TITLE = "这个体验暂时无法加载。";
const LEARNER_ERROR_MESSAGE = "请稍后再试，或检查本地实验开关。";
const BOUNDARY_MESSAGE =
  "语境体验已到达现有学习任务的交接点。\n下一阶段会通过 WordRanger 原有提交与证据流程完成这道题。";

export interface PrepareMealContextLabOptions {
  planningInput?: ExperiencePlanningInput;
}

export function mealBuildPlanningInput(
  capabilities: RuntimeCapability[] = typingCapabilities(),
): ExperiencePlanningInput {
  return {
    learningNeedRef: "need-opaque-ref",
    mode: "BUILD",
    targets: [spoonFormTarget()],
    allowedContextIds: [HOME_BREAKFAST_FRAME_ID],
    runtimeCapabilities: capabilities,
  };
}

export function prepareMealContextLab(
  options: PrepareMealContextLabOptions = {},
): ContextLabPilotPayload {
  const planned = planExperience(options.planningInput ?? mealBuildPlanningInput());
  if (!planned.ok) {
    return errorPayload(
      CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE,
      planned.error.code,
    );
  }

  const frame = findPlannerFrame(planned.plan.contextFrameId);
  const skeleton = findPlannerSkeleton(planned.plan.skeletonId);
  if (!frame || !skeleton || planned.plan.contextFrameId !== HOME_BREAKFAST_FRAME_ID) {
    return errorPayload(CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION);
  }

  const validated = validateExperiencePlan({
    plan: planned.plan,
    frame,
    skeleton,
    capabilities: options.planningInput?.runtimeCapabilities ?? typingCapabilities(),
    supportBlocks: PLANNER_SUPPORT_BLOCKS,
    senseProfiles: PLANNER_SENSE_PROFILES,
  });
  if (!validated.ok) {
    return errorPayload(
      CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
      validated.issues[0]?.code,
    );
  }

  const resolvedContext = resolveContextSnapshot(
    frame,
    skeleton,
    planned.plan.activeGoalId,
  );
  const resolvedTargets = resolvePlanTargets(planned.plan);
  const created = createExperienceRun({
    plan: planned.plan,
    resolvedContext,
    resolvedTargets,
    now: "2026-09-20T00:00:00.000Z",
    createId: () => "context-lab-meal-build",
  });
  if (!created.ok) {
    return errorPayload(
      CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
      created.error.code,
    );
  }

  return walkIssuedScreens(created.run, resolvedContext);
}

function walkIssuedScreens(
  initialRun: ExperienceRun,
  resolvedContext: ResolvedContextSnapshot,
): ContextLabPilotPayload {
  const screens: ContextLabScreen[] = [];
  let run = initialRun;
  const expectedGuided = 3;
  const total = expectedGuided + 1;

  while (run.status === "READY") {
    const issued = issueCurrentStep({
      run,
      now: "2026-09-20T00:00:00.000Z",
      createId: () => "context-lab-frozen-recall",
    });
    if (!issued.ok) {
      return errorPayload(mapIssueError(issued.error.code), issued.error.code);
    }

    if (issued.issuedActivity) {
      const context = presentGuidedContext(issued.issuedActivity, resolvedContext);
      if ("error" in context) {
        return errorPayload(context.error);
      }
      screens.push({
        kind: "GUIDED",
        activity: issued.issuedActivity,
        context,
        progress: progressFor(screens.length + 1, total),
      });
      const recorded = recordGuidedActivityCompletion({
        run: issued.run,
        receipt: {
          activityId: issued.issuedActivity.id,
          completedAt: "2026-09-20T00:00:00.000Z",
        },
        now: "2026-09-20T00:00:00.000Z",
      });
      if (!recorded.ok) {
        return errorPayload(
          CONTEXT_LAB_ERROR_CODES.GUIDED_GROUNDING_FAILURE,
          recorded.error.code,
        );
      }
      run = recorded.run;
      continue;
    }

    if (issued.issuedTask) {
      const context = presentFrozenContext(resolvedContext);
      if ("error" in context) {
        return errorPayload(context.error);
      }
      screens.push({
        kind: "FROZEN_TASK_PREVIEW",
        task: issued.issuedTask,
        context,
        progress: progressFor(total, total),
      });
      screens.push({
        kind: "PILOT_BOUNDARY",
        message: BOUNDARY_MESSAGE,
        progress: progressFor(total, total),
      });
      return { screens };
    }

    return errorPayload(CONTEXT_LAB_ERROR_CODES.FROZEN_COMPILATION_FAILURE);
  }

  return errorPayload(CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE);
}

function presentGuidedContext(
  activity: PublicGuidedActivity,
  resolvedContext: ResolvedContextSnapshot,
): PublicContextPresentation | { error: ContextLabErrorCode } {
  const scene = sceneEntities(resolvedContext);
  if ("error" in scene) {
    return scene;
  }
  const presentedEntityIds = activity.presentedEntityIds ?? [];
  for (const entityId of presentedEntityIds) {
    if (!mappedMealEntity(entityId)) {
      return { error: CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION };
    }
  }
  const highlightedEntityIds =
    activity.kind === "PRESENT_CONTEXT" ? [] : presentedEntityIds;

  const frameCopy = homeBreakfastFrameCopy();
  const context: PublicContextPresentation = {
    title: frameCopy.title,
    settingLabel: frameCopy.settingLabel,
    instruction: guidedInstructionFor(activity.kind),
    entities: scene,
    highlightedEntityIds,
  };

  if (activity.kind === "OBSERVE_RELATION") {
    const caption = groundedRelationCaption(activity, resolvedContext);
    if (!caption) {
      return { error: CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION };
    }
    context.relationCaption = caption;
  }

  if (activity.kind === "SHOW_CONTRAST") {
    const captions = [];
    for (const entityId of highlightedEntityIds) {
      const caption = contrastCaptionFor(entityId);
      if (!caption) {
        return { error: CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION };
      }
      captions.push({ entityId, caption });
    }
    context.contrastCaptions = captions;
  }

  return context;
}

function presentFrozenContext(
  resolvedContext: ResolvedContextSnapshot,
): PublicContextPresentation | { error: ContextLabErrorCode } {
  const scene = sceneEntities(resolvedContext);
  if ("error" in scene) {
    return scene;
  }
  const frameCopy = homeBreakfastFrameCopy();
  return {
    title: frameCopy.title,
    settingLabel: frameCopy.settingLabel,
    instruction: frozenPreviewInstruction(),
    entities: scene,
    highlightedEntityIds: ["home-spoon"],
  };
}

function sceneEntities(
  resolvedContext: ResolvedContextSnapshot,
): PublicContextEntityList | { error: ContextLabErrorCode } {
  const bound = new Set(
    resolvedContext.entityBindings.map((binding) => binding.entityId),
  );
  const entities = [];
  for (const entityId of HOME_BREAKFAST_SCENE_ENTITY_IDS) {
    if (!bound.has(entityId)) {
      return { error: CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION };
    }
    const mapped = mappedMealEntity(entityId);
    if (!mapped) {
      return { error: CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION };
    }
    entities.push(mapped);
  }
  return entities;
}

type PublicContextEntityList = PublicContextPresentation["entities"];

function groundedRelationCaption(
  activity: PublicGuidedActivity,
  resolvedContext: ResolvedContextSnapshot,
): string | undefined {
  const predicates = activity.presentedFactPredicates ?? [];
  const presented = new Set(activity.presentedEntityIds ?? []);
  for (const predicate of predicates) {
    for (const fact of resolvedContext.facts) {
      if (fact.predicate !== predicate) {
        continue;
      }
      const entityIds = fact.arguments.flatMap((argument) =>
        argument.kind === "ENTITY" ? [argument.entityId] : [],
      );
      if (entityIds.some((entityId) => !presented.has(entityId))) {
        continue;
      }
      const caption = relationCaptionFor(predicate, entityIds);
      if (caption) {
        return caption;
      }
    }
  }
  return undefined;
}

function resolvePlanTargets(
  plan: LearningExperiencePlan,
): ResolvedTargetSnapshot[] {
  return plan.targets.map((target) => ({
    targetId: target.id,
    sense: target.sense,
    displayForm: findProfile(PLANNER_SENSE_PROFILES, target.sense)?.displayForm ?? "",
    focus: target.focus,
  }));
}

function spoonFormTarget(): ExperienceTarget {
  return {
    id: "target-spoon",
    sense: MEAL_SENSE.spoon,
    focus: "MEANING_TO_FORM",
  };
}

function typingCapabilities(): RuntimeCapability[] {
  if (!TYPING_CAPABILITY) {
    return [];
  }
  return [TYPING_CAPABILITY];
}

function mapIssueError(code: string): ContextLabErrorCode {
  if (
    code === ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT ||
    code === ExecutionErrorCode.EXEC_GUIDED_FACT_NOT_IN_CONTEXT
  ) {
    return CONTEXT_LAB_ERROR_CODES.GUIDED_GROUNDING_FAILURE;
  }
  if (code.startsWith("COMPILATION_") || code === "EXP_RECALL_LEAKS_ANSWER") {
    return CONTEXT_LAB_ERROR_CODES.FROZEN_COMPILATION_FAILURE;
  }
  return CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE;
}

function progressFor(current: number, total: number): ContextLabProgress {
  return { current, total };
}

function errorPayload(
  code: ContextLabErrorCode,
  detail?: string,
): ContextLabPilotPayload {
  return {
    screens: [
      {
        kind: "ERROR",
        title: LEARNER_ERROR_TITLE,
        message: LEARNER_ERROR_MESSAGE,
        code: detail ? `${code}:${detail}` : code,
      },
    ],
  };
}
