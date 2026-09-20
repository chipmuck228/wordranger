import "server-only";

import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { validateExperienceRun } from "@/contextual-learning/candidate-v0/execution/validate-experience-run";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution/types";
import { ContextLabError } from "./context-lab-errors";
import {
  CONTEXT_LAB_RUN_SCHEMA_VERSION,
  type ContextLabRunRecord,
} from "./context-lab-run.types";
import type { MealProbeOrchestration } from "./meal-probe-orchestration";

const ANSWER_KEY_FIELDS = [
  "answerKey",
  "correctOptionIds",
  "optionLexemeIds",
  "expectedAnswer",
  "semanticAcceptedTexts",
  "exactAcceptedTexts",
] as const;

const ORCHESTRATION_KIND = "CONTEXT_LAB_ORCHESTRATION_V0";

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

export function serializeContextLabRunState(input: {
  experienceRun: ExperienceRun;
  probe: MealProbeOrchestration | null;
}): unknown {
  const payload = input.probe
    ? {
        kind: ORCHESTRATION_KIND,
        schemaVersion: CONTEXT_LAB_RUN_SCHEMA_VERSION,
        id: input.experienceRun.id,
        experienceId: input.experienceRun.experienceId,
        probe: input.probe,
        experienceRun: input.experienceRun,
      }
    : input.experienceRun;
  assertNoAnswerKeyFields(payload);
  return structuredClone(payload);
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
  const parsed = unwrapRunState(input.runState, input.id, input.experienceId);
  const invalid = validateExperienceRun(parsed.experienceRun);
  if (invalid) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
      "Stored Context Lab run failed ExperienceRun validation",
      false,
    );
  }
  assertNoAnswerKeyFields(parsed);
  return {
    id: input.id,
    userId: input.userId,
    schemaVersion: CONTEXT_LAB_RUN_SCHEMA_VERSION,
    experienceId: input.experienceId,
    experienceRun: structuredClone(parsed.experienceRun),
    probe: parsed.probe ? structuredClone(parsed.probe) : null,
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function unwrapRunState(
  runState: unknown,
  id: string,
  experienceId: string,
): { experienceRun: ExperienceRun; probe: MealProbeOrchestration | null } {
  if (!runState || typeof runState !== "object") {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
      "Stored Context Lab run is not a valid ExperienceRun",
      false,
    );
  }
  const state = runState as {
    kind?: string;
    schemaVersion?: string;
    id?: string;
    experienceId?: string;
    probe?: MealProbeOrchestration | null;
    experienceRun?: ExperienceRun;
    status?: string;
  };
  if (state.kind === ORCHESTRATION_KIND) {
    if (
      state.schemaVersion !== CONTEXT_LAB_RUN_SCHEMA_VERSION ||
      state.id !== id ||
      state.experienceId !== experienceId ||
      !state.experienceRun
    ) {
      throw new ContextLabError(
        CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
        "Stored Context Lab orchestration is invalid",
        false,
      );
    }
    return {
      experienceRun: state.experienceRun,
      probe: state.probe ?? null,
    };
  }
  const run = runState as ExperienceRun;
  if (
    run.schemaVersion !== CONTEXT_LAB_RUN_SCHEMA_VERSION ||
    run.id !== id ||
    run.experienceId !== experienceId
  ) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
      "Stored Context Lab run is not a valid ExperienceRun",
      false,
    );
  }
  return { experienceRun: run, probe: null };
}
