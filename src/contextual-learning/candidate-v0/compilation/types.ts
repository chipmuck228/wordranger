/**
 * Candidate V0 / Experimental / Not a Standard.
 * Compiler I/O uses frozen PublicLearningTask / TaskAnswerKey by reference.
 */

import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";
import type { DomainErrorCode } from "../domain/errors";
import type {
  CompilationTrace,
  ExperienceId,
  ExperienceStepSpec,
  ResolvedContextSnapshot,
  ResolvedTargetSnapshot,
  StepSupportPolicy,
} from "../domain/types";

export interface TaskCompilationRequest {
  experienceId: ExperienceId;
  learningNeedId: string;
  step: ExperienceStepSpec;
  resolvedContext: ResolvedContextSnapshot;
  resolvedTargets: ResolvedTargetSnapshot[];
  supportPolicy: StepSupportPolicy;
  now?: string;
  createId?: () => string;
}

export interface TaskCompilationResult {
  stepId: string;
  publicLearningTask: PublicLearningTask;
  answerKey: TaskAnswerKey;
  trace: CompilationTrace;
}

export interface CompilationError {
  code: DomainErrorCode | string;
  message: string;
  path: string;
}

export type CompileResult =
  | { ok: true; value: TaskCompilationResult }
  | { ok: false; error: CompilationError };

export function compileOk(value: TaskCompilationResult): CompileResult {
  return { ok: true, value };
}

export function compileFail(
  code: DomainErrorCode | string,
  message: string,
  path = "step",
): CompileResult {
  return { ok: false, error: { code, message, path } };
}
