import "server-only";

import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { validateExperienceRun } from "@/contextual-learning/candidate-v0/execution/validate-experience-run";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution/types";
import { ContextLabError } from "./context-lab-errors";
import {
  CONTEXT_LAB_RUN_SCHEMA_VERSION,
  type ContextLabRunRecord,
} from "./context-lab-run.types";

const ANSWER_KEY_FIELDS = [
  "answerKey",
  "correctOptionIds",
  "optionLexemeIds",
  "expectedAnswer",
  "semanticAcceptedTexts",
  "exactAcceptedTexts",
] as const;

export function assertNoAnswerKeyFields(value: unknown): void {
  const json = JSON.stringify(value);
  for (const field of ANSWER_KEY_FIELDS) {
    if (json.includes(`"${field}"`)) {
      throw new ContextLabError(
        CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
        "Refusing to persist answer-key fields in Context Lab orchestration",
        false,
      );
    }
  }
}

export function serializeContextLabRunState(run: ExperienceRun): ExperienceRun {
  assertNoAnswerKeyFields(run);
  return structuredClone(run);
}

export function parseContextLabRunRecord(input: {
  id: string;
  userId: string;
  expectedUserId: string;
  schemaVersion: string;
  experienceId: string;
  runState: unknown;
  revision: number;
  createdAt: string;
  updatedAt: string;
}): ContextLabRunRecord {
  if (input.userId !== input.expectedUserId) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_NOT_FOUND,
      "Context Lab run does not belong to the current user",
      true,
    );
  }
  if (input.schemaVersion !== CONTEXT_LAB_RUN_SCHEMA_VERSION) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
      "Unknown Context Lab run schema version",
      false,
    );
  }
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
      "Context Lab revision is not a valid concurrency token",
      false,
    );
  }
  const run = input.runState as ExperienceRun;
  if (
    !run ||
    typeof run !== "object" ||
    run.schemaVersion !== CONTEXT_LAB_RUN_SCHEMA_VERSION ||
    run.id !== input.id ||
    run.experienceId !== input.experienceId
  ) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
      "Stored Context Lab run is not a valid ExperienceRun",
      false,
    );
  }
  const invalid = validateExperienceRun(run);
  if (invalid) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
      "Stored Context Lab run failed ExperienceRun validation",
      false,
    );
  }
  assertNoAnswerKeyFields(run);
  return {
    id: input.id,
    userId: input.userId,
    schemaVersion: CONTEXT_LAB_RUN_SCHEMA_VERSION,
    experienceId: input.experienceId,
    experienceRun: structuredClone(run),
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
