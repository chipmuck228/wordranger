/**
 * Presentation-only Context Lab UI contract.
 * Candidate V0 / Experimental / Not a Standard.
 * The client receives exactly one current screen plus an opaque run handle.
 * No answer keys, Evidence, learner-state, future steps, or full ExperienceRun.
 */

import type { PublicGuidedActivity } from "@/contextual-learning/candidate-v0/execution/guided-activity";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";

export type ContextEntityRole = "FOOD" | "CONTAINER" | "TOOL";

export interface PublicContextEntity {
  id: string;
  label: string;
  role: ContextEntityRole;
}

export interface PublicContextPresentation {
  title: string;
  settingLabel: string;
  instruction: string;
  entities: PublicContextEntity[];
  highlightedEntityIds: string[];
  relationCaption?: string;
  contrastCaptions?: Array<{
    entityId: string;
    caption: string;
  }>;
  supportReveal?: {
    kind: "LEXICAL_FORM" | "SPELLING_CUE";
    lexicalForm?: string;
    meaningGloss?: string;
    phonetic?: string;
    inflectionNote?: string;
    spellingCue?: string;
    note: string;
  };
}

export interface ContextLabProgress {
  current: number;
  total: number;
  unit?: string;
}

export interface ContextLabRunHandle {
  runId: string;
  revision: number;
  contentReleaseId?: string;
}

export interface PublicProbeRoutingItem {
  entityId: string;
  label: string;
  summary: string;
  capabilityNote?: string;
}

export type ContextLabHandoffIntent = "START_BUILD" | "START_STRENGTHEN";

export type ContextLabTaskPresentationMode = "SCENE_TARGET" | "TASK_ONLY";

export type ContextLabCurrentScreen =
  | {
      kind: "PROBE_INTRO";
      handle: ContextLabRunHandle;
      context: PublicContextPresentation;
      progress: ContextLabProgress;
    }
  | {
      kind: "PROBE_SUMMARY";
      handle: ContextLabRunHandle;
      context: PublicContextPresentation;
      progress: ContextLabProgress;
      items: PublicProbeRoutingItem[];
      canHandoffToBuild: boolean;
      canHandoffToStrengthen: boolean;
      strengthenButtonLabel?: string;
      buildButtonLabel?: string;
      pendingMessage: string | null;
    }
  | {
      kind: "GUIDED";
      handle: ContextLabRunHandle;
      activity: PublicGuidedActivity;
      context: PublicContextPresentation;
      progress: ContextLabProgress;
      teachingPhase?: boolean;
      strengthenPhase?: "RECONNECT" | "FADE";
      buildPhase?: "GROUND" | "CONNECT" | "TEACH" | "CONTRAST" | "FADE";
      acknowledgeLabel?: string;
    }
  | {
      kind: "FROZEN_TASK_PREVIEW";
      handle: ContextLabRunHandle;
      task: PublicLearningTask;
      context: PublicContextPresentation;
      progress: ContextLabProgress;
      presentationMode?: ContextLabTaskPresentationMode;
      strengthenPhase?: "VERIFY";
      buildPhase?: "VERIFY";
    }
  | {
      kind: "PROBE_TASK_RECORDED";
      handle: ContextLabRunHandle;
      progress: ContextLabProgress;
      message: string;
    }
  | {
      kind: "FROZEN_TASK_RECORDED";
      handle: ContextLabRunHandle;
      feedback: ContextLabTaskFeedback;
      recordedMessage: string;
      progress: ContextLabProgress;
      continueAvailable?: boolean;
      continueLabel?: string;
      queueCompleteMessage?: string;
    }
  | {
      kind: "ERROR";
      code: string;
      title: string;
      message: string;
      recoverable: boolean;
    };

export interface ContextLabTaskFeedback {
  status: "CORRECT" | "ASSISTED" | "INCORRECT" | "SKIPPED" | "TIMEOUT";
  message: string;
  correction?: { text: string };
}

/** @deprecated Use ContextLabCurrentScreen. Kept as an alias during the controller cutover. */
export type ContextLabScreen = ContextLabCurrentScreen;

export const CONTEXT_LAB_ERROR_CODES = {
  FEATURE_DISABLED: "FEATURE_DISABLED",
  PLANNER_FAILURE: "PLANNER_FAILURE",
  PLAN_VALIDATION_FAILURE: "PLAN_VALIDATION_FAILURE",
  GUIDED_GROUNDING_FAILURE: "GUIDED_GROUNDING_FAILURE",
  FROZEN_COMPILATION_FAILURE: "FROZEN_COMPILATION_FAILURE",
  MISSING_PUBLIC_PRESENTATION: "MISSING_PUBLIC_PRESENTATION",
  CONTEXT_LAB_STALE_RUN: "CONTEXT_LAB_STALE_RUN",
  CONTEXT_LAB_NOT_FOUND: "CONTEXT_LAB_NOT_FOUND",
  CONTEXT_LAB_RUNTIME_INVALID: "CONTEXT_LAB_RUNTIME_INVALID",
  CONTEXT_LAB_ACK_REJECTED: "CONTEXT_LAB_ACK_REJECTED",
  CONTEXT_LAB_SUBMIT_REJECTED: "CONTEXT_LAB_SUBMIT_REJECTED",
  CONTEXT_LAB_TASK_CONFLICT: "CONTEXT_LAB_TASK_CONFLICT",
  CONTEXT_LAB_CONTENT_UNAVAILABLE: "CONTEXT_LAB_CONTENT_UNAVAILABLE",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export type ContextLabErrorCode =
  (typeof CONTEXT_LAB_ERROR_CODES)[keyof typeof CONTEXT_LAB_ERROR_CODES];

export const CONTEXT_LAB_HEADING_ID = "context-lab-heading";

export const CONTEXT_LAB_RECORDED_MESSAGE = "这次练习已记录。";
export const CONTEXT_LAB_STRENGTHEN_RECORDED_MESSAGE = "这次强化已经记录。";
export const CONTEXT_LAB_STRENGTHEN_ASSISTED_MESSAGE = "这次是在提示后答对的。";
export const CONTEXT_LAB_STRENGTHEN_QUEUE_COMPLETE_MESSAGE =
  "本次需要强化的词已经完成。";
export const CONTEXT_LAB_STRENGTHEN_NEXT_LABEL = "继续下一个";
export const CONTEXT_LAB_BUILD_QUEUE_COMPLETE_MESSAGE =
  "本次需要建立的词已经完成。";
export const CONTEXT_LAB_BUILD_NEXT_LABEL = "继续下一个";
export const CONTEXT_LAB_RETURN_TO_SUMMARY_LABEL = "回到这次检查";
export const CONTEXT_LAB_PROBE_RECORDED_MESSAGE = "这次回答已记录，请继续。";
export const CONTEXT_LAB_PROBE_UNIT = "个目标词";
export const CONTEXT_LAB_BUILD_UNIT = "个需要建立的词";
export const CONTEXT_LAB_STRENGTHEN_UNIT = "个需要强化的词";
export const CONTEXT_LAB_INLINE_RECORDED_STATUS = "已记录";
export const CONTEXT_LAB_AUTO_CONTINUE_FAILED_MESSAGE =
  "已记录，但暂时没能进入下一词，请重试";
export const CONTEXT_LAB_BOUNDARY_MESSAGE =
  "语境体验已到达现有学习任务的交接点。\n下一阶段会通过 WordRanger 原有提交与证据流程完成这道题。";

export const CONTEXT_LAB_LEARNER_ERROR_TITLE = "这个体验暂时无法加载。";
export const CONTEXT_LAB_LEARNER_ERROR_MESSAGE =
  "请稍后再试，或检查本地实验开关。";
export const CONTEXT_LAB_STALE_MESSAGE =
  "这一步已经更新，请重新同步当前进度。";
export const CONTEXT_LAB_NETWORK_MESSAGE = "暂时没能继续这一步，请再试一次。";
export const CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE = "这次提交无法完成，请再试一次。";

export function formatContextLabProgress(progress: ContextLabProgress): string {
  if (progress.current <= 0) {
    return progress.unit ? `共 ${progress.total} ${progress.unit}` : `共 ${progress.total}`;
  }
  return progress.unit
    ? `第 ${progress.current} / ${progress.total} ${progress.unit}`
    : `${progress.current} / ${progress.total}`;
}

export function formatContextLabProgressLabel(progress: ContextLabProgress): string {
  return `进度 ${formatContextLabProgress(progress)}`;
}

export function shouldAutoAdvanceRecorded(
  screen: ContextLabCurrentScreen,
): boolean {
  if (screen.kind === "PROBE_TASK_RECORDED") {
    return true;
  }
  if (screen.kind !== "FROZEN_TASK_RECORDED") {
    return false;
  }
  return (
    screen.continueAvailable === true &&
    screen.continueLabel === CONTEXT_LAB_BUILD_NEXT_LABEL &&
    !screen.queueCompleteMessage
  );
}
