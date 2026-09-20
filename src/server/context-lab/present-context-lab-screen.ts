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
  CONTEXT_LAB_ERROR_CODES,
  CONTEXT_LAB_PROBE_RECORDED_MESSAGE,
  CONTEXT_LAB_RECORDED_MESSAGE,
  CONTEXT_LAB_STRENGTHEN_ASSISTED_MESSAGE,
  CONTEXT_LAB_STRENGTHEN_RECORDED_MESSAGE,
  type ContextLabCurrentScreen,
  type ContextLabErrorCode,
  type ContextLabProgress,
  type ContextLabRunHandle,
  type ContextLabTaskFeedback,
  type ContextLabTaskPresentationMode,
  type PublicContextPresentation,
  type PublicProbeRoutingItem,
} from "@/components/context-lab/types";
import type { ContextualProbeSkill } from "@/contextual-learning/candidate-v0/probe/types";
import type { MealLexicalStrengthenProfile } from "@/contextual-learning/candidate-v0/strengthen/types";
import { spellingCueFromDisplayForm } from "@/contextual-learning/candidate-v0/strengthen/spelling-cue";
import { errorScreen } from "./context-lab-errors";
import {
  contrastCaptionFor,
  frozenPreviewInstruction,
  guidedInstructionFor,
  HOME_BREAKFAST_SCENE_ENTITY_IDS,
  homeBreakfastFrameCopy,
  mappedMealEntity,
  relationCaptionFor,
  strengthenReconnectInstruction,
  strengthenTitleFor,
  strengthenVerifyInstruction,
} from "./meal-presentation-map";

export function presentGuidedScreen(input: {
  handle: ContextLabRunHandle;
  activity: PublicGuidedActivity;
  resolvedContext: ResolvedContextSnapshot;
  progress: ContextLabProgress;
  planMode?: "BUILD" | "STRENGTHEN";
  supportReveal?: PublicContextPresentation["supportReveal"];
  strengthenProfile?: MealLexicalStrengthenProfile | null;
}): ContextLabCurrentScreen {
  const context = presentGuidedContext(input.activity, input.resolvedContext);
  if ("error" in context) {
    return errorScreen(context.error);
  }
  if (input.planMode === "STRENGTHEN") {
    const profile = input.strengthenProfile;
    if (!profile) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION);
    }
    const strengthenPhase =
      input.activity.kind === "FADE_FORM" ? "FADE" : "RECONNECT";
    const supportReveal =
      input.supportReveal ??
      (input.activity.kind === "FADE_FORM" ||
      input.activity.kind === "RECONNECT_FORM"
        ? strengthenSupportReveal(profile, input.activity.kind)
        : undefined);
    if (!supportReveal) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION);
    }
    const title = strengthenTitleFor(profile.displayLabel);
    return {
      kind: "GUIDED",
      handle: input.handle,
      activity: input.activity,
      context: {
        ...context,
        title,
        settingLabel: `强化阶段：${title}`,
        instruction:
          strengthenPhase === "FADE"
            ? "完整英文已经收起。下面是提示，不是答案。"
            : strengthenReconnectInstruction(profile.displayLabel),
        highlightedEntityIds: [profile.entityId],
        supportReveal,
      },
      progress: input.progress,
      teachingPhase: false,
      strengthenPhase,
      acknowledgeLabel: strengthenPhase === "FADE" ? "试着自己写" : "继续",
    };
  }
  return {
    kind: "GUIDED",
    handle: input.handle,
    activity: input.activity,
    context: {
      ...context,
      settingLabel: "教学阶段：建立勺子的情境记忆",
    },
    progress: input.progress,
    teachingPhase: true,
  };
}

export function presentFrozenTaskScreen(input: {
  handle: ContextLabRunHandle;
  task: PublicLearningTask;
  resolvedContext: ResolvedContextSnapshot;
  progress: ContextLabProgress;
  planMode?: "BUILD" | "STRENGTHEN";
  strengthenProfile?: MealLexicalStrengthenProfile | null;
}): ContextLabCurrentScreen {
  const context = presentFrozenContext(input.resolvedContext, input.strengthenProfile);
  if ("error" in context) {
    return errorScreen(context.error);
  }
  if (input.planMode === "STRENGTHEN") {
    const profile = input.strengthenProfile;
    if (!profile) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION);
    }
    const title = strengthenTitleFor(profile.displayLabel);
    return {
      kind: "FROZEN_TASK_PREVIEW",
      handle: input.handle,
      task: input.task,
      context: {
        ...context,
        title,
        settingLabel: `强化阶段：${title}`,
        instruction: strengthenVerifyInstruction(profile.displayLabel),
        highlightedEntityIds: [profile.entityId],
        supportReveal: undefined,
      },
      progress: input.progress,
      presentationMode: "SCENE_TARGET",
      strengthenPhase: "VERIFY",
    };
  }
  return {
    kind: "FROZEN_TASK_PREVIEW",
    handle: input.handle,
    task: input.task,
    context,
    progress: input.progress,
  };
}

export function presentRecordedScreen(input: {
  handle: ContextLabRunHandle;
  feedback: ContextLabTaskFeedback;
  progress: ContextLabProgress;
  continueAvailable?: boolean;
  continueLabel?: string;
  planMode?: "BUILD" | "STRENGTHEN";
  recordedMessage?: string;
  queueCompleteMessage?: string;
}): ContextLabCurrentScreen {
  const feedback =
    input.planMode === "STRENGTHEN" && input.feedback.status === "ASSISTED"
      ? { ...input.feedback, message: CONTEXT_LAB_STRENGTHEN_ASSISTED_MESSAGE }
      : input.feedback;
  return {
    kind: "FROZEN_TASK_RECORDED",
    handle: input.handle,
    feedback,
    recordedMessage:
      input.recordedMessage ??
      (input.planMode === "STRENGTHEN"
        ? CONTEXT_LAB_STRENGTHEN_RECORDED_MESSAGE
        : CONTEXT_LAB_RECORDED_MESSAGE),
    progress: input.progress,
    continueAvailable: input.continueAvailable,
    continueLabel: input.continueLabel,
    queueCompleteMessage: input.queueCompleteMessage,
  };
}

export function presentProbeIntroScreen(input: {
  handle: ContextLabRunHandle;
  progress: ContextLabProgress;
}): ContextLabCurrentScreen {
  const frameCopy = homeBreakfastFrameCopy();
  return {
    kind: "PROBE_INTRO",
    handle: input.handle,
    context: {
      title: frameCopy.title,
      settingLabel: "先看看你已经会了哪些词",
      instruction: "桌上有几件早餐物品。先检查，教学还没开始。",
      entities: probeSceneEntities(),
      highlightedEntityIds: [],
    },
    progress: withProbeUnit(input.progress),
  };
}

export function presentProbeRecordedScreen(input: {
  handle: ContextLabRunHandle;
  progress: ContextLabProgress;
}): ContextLabCurrentScreen {
  return {
    kind: "PROBE_TASK_RECORDED",
    handle: input.handle,
    progress: withProbeUnit(input.progress),
    message: CONTEXT_LAB_PROBE_RECORDED_MESSAGE,
  };
}

export function presentProbeFrozenTaskScreen(input: {
  handle: ContextLabRunHandle;
  task: PublicLearningTask;
  skill: ContextualProbeSkill;
  entityId: string;
  progress: ContextLabProgress;
}): ContextLabCurrentScreen {
  const presentationMode: ContextLabTaskPresentationMode =
    input.skill === "ACTIVE_RECALL" ? "SCENE_TARGET" : "TASK_ONLY";
  return {
    kind: "FROZEN_TASK_PREVIEW",
    handle: input.handle,
    task: input.task,
    context:
      presentationMode === "SCENE_TARGET"
        ? presentProbeRecallContext(input.entityId)
        : presentProbeRecognitionContext(),
    progress: withProbeUnit(input.progress),
    presentationMode,
  };
}

export function presentProbeRecallContext(
  highlightedEntityId: string,
): PublicContextPresentation {
  const frameCopy = homeBreakfastFrameCopy();
  return {
    title: frameCopy.title,
    settingLabel: "先看看你已经会了哪些词",
    instruction: "写出当前物品的英文单词。还没有开始教学。",
    entities: probeSceneEntities(),
    highlightedEntityIds: [highlightedEntityId],
  };
}

export function presentProbeRecognitionContext(): PublicContextPresentation {
  const frameCopy = homeBreakfastFrameCopy();
  return {
    title: frameCopy.title,
    settingLabel: "看看这个英文词表示什么",
    instruction: "这是检查，不是教学。",
    entities: [],
    highlightedEntityIds: [],
  };
}

/** @deprecated Use presentProbeRecallContext / presentProbeRecognitionContext. */
export function presentProbeTaskContext(
  highlightedEntityId: string,
): PublicContextPresentation {
  return presentProbeRecallContext(highlightedEntityId);
}

export function presentProbeSummaryScreen(input: {
  handle: ContextLabRunHandle;
  progress: ContextLabProgress;
  items: PublicProbeRoutingItem[];
  canHandoffToBuild: boolean;
  canHandoffToStrengthen: boolean;
  strengthenButtonLabel?: string;
  pendingMessage: string | null;
}): ContextLabCurrentScreen {
  const frameCopy = homeBreakfastFrameCopy();
  return {
    kind: "PROBE_SUMMARY",
    handle: input.handle,
    context: {
      title: frameCopy.title,
      settingLabel: "先看看你已经会了哪些词",
      instruction: "这是这次检查的下一步建议，不是永久掌握程度。",
      entities: probeSceneEntities(),
      highlightedEntityIds: [],
    },
    progress: withProbeUnit(input.progress),
    items: input.items,
    canHandoffToBuild: input.canHandoffToBuild,
    canHandoffToStrengthen: input.canHandoffToStrengthen,
    strengthenButtonLabel: input.strengthenButtonLabel,
    pendingMessage: input.pendingMessage,
  };
}

function probeSceneEntities(): PublicContextPresentation["entities"] {
  return HOME_BREAKFAST_SCENE_ENTITY_IDS.map((entityId) => mappedMealEntity(entityId)!);
}

function withProbeUnit(progress: ContextLabProgress): ContextLabProgress {
  return { ...progress, unit: progress.unit ?? "个物品" };
}

export function strengthenSupportReveal(
  profile: MealLexicalStrengthenProfile,
  kind: "RECONNECT_FORM" | "FADE_FORM",
): PublicContextPresentation["supportReveal"] | undefined {
  if (!profile.displayForm || !profile.meaningGloss) {
    return undefined;
  }
  if (kind === "RECONNECT_FORM") {
    return {
      kind: "LEXICAL_FORM",
      lexicalForm: profile.displayForm,
      meaningGloss: profile.meaningGloss,
      phonetic: profile.phonetic,
      note: "这是强化提示，不是测试。",
    };
  }
  const spellingCue = spellingCueFromDisplayForm(profile.displayForm);
  if (!spellingCue) {
    return undefined;
  }
  return {
    kind: "SPELLING_CUE",
    spellingCue,
    note: "这是拼写提示，不是完整答案。",
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
  strengthenProfile?: MealLexicalStrengthenProfile | null,
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
    highlightedEntityIds: [strengthenProfile?.entityId ?? "home-spoon"],
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
