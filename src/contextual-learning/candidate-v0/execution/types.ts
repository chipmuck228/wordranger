/**
 * Candidate V0 / Experimental / Not a Standard.
 * Domain-only experience sequencing. Does not grade or update learner state.
 */

import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";
import type { CompilationError } from "../compilation/types";
import type {
  CompilationTrace,
  LearningExperiencePlan,
  ResolvedContextSnapshot,
  ResolvedTargetSnapshot,
} from "../domain/types";
import type { StepExecutionClassification } from "./classify-step";
import type { ExperienceExecutionError } from "./errors";
import type {
  GuidedActivityCompletionReceipt,
  PublicGuidedActivity,
} from "./guided-activity";

export type ExperienceRunStatus =
  | "READY"
  | "FROZEN_TASK_ISSUED"
  | "GUIDED_ACTIVITY_ISSUED"
  | "BLOCKED"
  | "COMPLETED"
  | "ABORTED";

export type ExperienceStepRunStatus =
  | "PENDING"
  | "COMPILATION_FAILED"
  | "FROZEN_TASK_ISSUED"
  | "GUIDED_ACTIVITY_ISSUED"
  | "STEP_COMPLETED"
  | "BLOCKED";

export interface ExperiencePlanSnapshot {
  plan: LearningExperiencePlan;
  resolvedContext: ResolvedContextSnapshot;
  resolvedTargets: ResolvedTargetSnapshot[];
}

export interface ExperienceStepRun {
  stepId: string;
  status: ExperienceStepRunStatus;
  classification?: StepExecutionClassification;
  taskId?: string;
  activityId?: string;
  compilationTrace?: CompilationTrace;
  compilationError?: CompilationError;
  issuedAt?: string;
  completedAt?: string;
}

export interface ExperienceRun {
  id: string;
  schemaVersion: "candidate-v0";
  experienceId: string;
  planSnapshot: ExperiencePlanSnapshot;
  status: ExperienceRunStatus;
  currentStepIndex: number;
  stepRuns: ExperienceStepRun[];
  createdAt: string;
  updatedAt: string;
  abortReason?: string;
}

/**
 * External completion identity only. No outcome, score, or skill.
 */
export interface FrozenTaskCompletionReceipt {
  taskId: string;
  completedAt: string;
}

export type ExperienceRunCommand =
  | {
      kind: "ISSUE_CURRENT_STEP";
      createId?: () => string;
    }
  | {
      kind: "RECORD_FROZEN_TASK_COMPLETION";
      receipt: FrozenTaskCompletionReceipt;
    }
  | {
      kind: "RECORD_GUIDED_ACTIVITY_COMPLETION";
      receipt: GuidedActivityCompletionReceipt;
    }
  | {
      kind: "ABORT";
      reason: string;
    };

export type ExperienceRunResult =
  | {
      ok: true;
      run: ExperienceRun;
      issuedTask?: PublicLearningTask;
      answerKey?: TaskAnswerKey;
      issuedActivity?: PublicGuidedActivity;
      classification?: StepExecutionClassification;
    }
  | {
      ok: false;
      run: ExperienceRun;
      error: ExperienceExecutionError;
      issuedActivity?: PublicGuidedActivity;
      classification?: StepExecutionClassification;
    };
