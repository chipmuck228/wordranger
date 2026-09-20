import "server-only";

/**
 * Maps an issued Candidate step to one public Context Lab screen.
 * Presentation facts stay server-authored. No future steps are walked.
 */

import type { PublicGuidedActivity } from "@/contextual-learning/candidate-v0/execution/guided-activity";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { ResolvedContextSnapshot } from "@/contextual-learning/candidate-v0/domain/types";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution/types";
import {
  CONTEXT_LAB_BOUNDARY_MESSAGE,
  CONTEXT_LAB_ERROR_CODES,
  type ContextLabCurrentScreen,
  type ContextLabErrorCode,
  type ContextLabProgress,
  type ContextLabRunHandle,
  type PublicContextPresentation,
} from "@/components/context-lab/types";
import { errorScreen } from "./context-lab-errors";
import {
  contrastCaptionFor,
  frozenPreviewInstruction,
  guidedInstructionFor,
  HOME_BREAKFAST_SCENE_ENTITY_IDS,
  homeBreakfastFrameCopy,
  mappedMealEntity,
  relationCaptionFor,
} from "./meal-presentation-map";

export function presentGuidedScreen(input: {
  handle: ContextLabRunHandle;
  activity: PublicGuidedActivity;
  resolvedContext: ResolvedContextSnapshot;
  progress: ContextLabProgress;
}): ContextLabCurrentScreen {
  const context = presentGuidedContext(input.activity, input.resolvedContext);
  if ("error" in context) {
    return errorScreen(context.error);
  }
  return {
    kind: "GUIDED",
    handle: input.handle,
    activity: input.activity,
    context,
    progress: input.progress,
  };
}

export function presentFrozenTaskScreen(input: {
  handle: ContextLabRunHandle;
  task: PublicLearningTask;
  resolvedContext: ResolvedContextSnapshot;
  progress: ContextLabProgress;
}): ContextLabCurrentScreen {
  const context = presentFrozenContext(input.resolvedContext);
  if ("error" in context) {
    return errorScreen(context.error);
  }
  return {
    kind: "FROZEN_TASK_PREVIEW",
    handle: input.handle,
    task: input.task,
    context,
    progress: input.progress,
  };
}

export function presentHandoffScreen(input: {
  handle: ContextLabRunHandle;
  progress: ContextLabProgress;
}): ContextLabCurrentScreen {
  return {
    kind: "FROZEN_TASK_HANDOFF_READY",
    handle: input.handle,
    message: CONTEXT_LAB_BOUNDARY_MESSAGE,
    progress: input.progress,
  };
}

export function progressForIssuedRun(run: ExperienceRun): ContextLabProgress {
  return {
    current: run.currentStepIndex + 1,
    total: run.planSnapshot.plan.steps.length,
  };
}

export function presentGuidedContext(
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

export function presentFrozenContext(
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
): PublicContextPresentation["entities"] | { error: ContextLabErrorCode } {
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
