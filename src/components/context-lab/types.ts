/**
 * Presentation-only Context Lab UI contract.
 * Candidate V0 / Experimental / Not a Standard.
 * No answer keys, Evidence, or learner-state fields.
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
}

export interface ContextLabProgress {
  current: number;
  total: number;
}

export type ContextLabScreen =
  | {
      kind: "GUIDED";
      activity: PublicGuidedActivity;
      context: PublicContextPresentation;
      progress: ContextLabProgress;
    }
  | {
      kind: "FROZEN_TASK_PREVIEW";
      task: PublicLearningTask;
      context: PublicContextPresentation;
      progress: ContextLabProgress;
    }
  | {
      kind: "PILOT_BOUNDARY";
      message: string;
      progress: ContextLabProgress;
    }
  | {
      kind: "ERROR";
      title: string;
      message: string;
      code: string;
    };

export interface ContextLabPilotPayload {
  screens: ContextLabScreen[];
}

export const CONTEXT_LAB_ERROR_CODES = {
  FEATURE_DISABLED: "FEATURE_DISABLED",
  PLANNER_FAILURE: "PLANNER_FAILURE",
  PLAN_VALIDATION_FAILURE: "PLAN_VALIDATION_FAILURE",
  GUIDED_GROUNDING_FAILURE: "GUIDED_GROUNDING_FAILURE",
  FROZEN_COMPILATION_FAILURE: "FROZEN_COMPILATION_FAILURE",
  MISSING_PUBLIC_PRESENTATION: "MISSING_PUBLIC_PRESENTATION",
} as const;

export type ContextLabErrorCode =
  (typeof CONTEXT_LAB_ERROR_CODES)[keyof typeof CONTEXT_LAB_ERROR_CODES];
