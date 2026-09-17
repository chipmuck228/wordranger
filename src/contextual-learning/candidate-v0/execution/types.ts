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
import type { ExperienceExecutionError } from "./errors";

export type ExperienceRunStatus =
  | "READY"
  | "TASK_ISSUED"
  | "BLOCKED"
  | "COMPLETED"
  | "ABORTED";

export type ExperienceStepRunStatus =
  | "PENDING"
  | "COMPILATION_FAILED"
  | "TASK_ISSUED"
  | "TASK_COMPLETED"
  | "BLOCKED";

export interface ExperiencePlanSnapshot {
  plan: LearningExperiencePlan;
  resolvedContext: ResolvedContextSnapshot;
  resolvedTargets: ResolvedTargetSnapshot[];
}

export interface ExperienceStepRun {
  stepId: string;
  status: ExperienceStepRunStatus;
  taskId?: string;
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
      kind: "RECORD_TASK_COMPLETION";
      receipt: FrozenTaskCompletionReceipt;
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
    }
  | {
      ok: false;
      run: ExperienceRun;
      error: ExperienceExecutionError;
    };
