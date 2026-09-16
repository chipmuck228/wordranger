"use server";

import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { RangerTrialSessionController } from "@/server/game-session/ranger-trial-session";
import {
  GAME_SESSION_USER_MESSAGES,
  GameSessionError,
  type GameSessionErrorCode,
} from "@/server/game-session/ranger-trial-errors";
import { InMemoryRangerTrialSessionStore } from "@/server/game-session/in-memory-ranger-trial-session-store";
import type {
  ContinueRangerTrialResult,
  ResumeRangerTrialResult,
  StartRangerTrialResult,
  StudentActionIntent,
  SubmitRangerTrialResult,
} from "@/server/game-session/ranger-trial-session.types";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";

const vocabulary = new InMemoryVocabularyRepository(getVocabularyDataset());
const learning = new InMemoryLearningRepository();
const query = new InMemoryLearningStateQueryRepository(learning);
const tasks = new InMemoryLearningTaskRepository();
const sessions = new InMemoryRangerTrialSessionStore();
const generator = new DefaultTaskGenerator(vocabulary);

function controller() {
  return new RangerTrialSessionController({
    userId: V1_PLACEHOLDER_USER_ID,
    vocabulary,
    query,
    tasks,
    learning,
    sessions,
    generator,
    random: new SeededRandomSource("ranger-trial-play"),
    createId: () => crypto.randomUUID(),
    createSessionId: () => crypto.randomUUID(),
    createEvidenceId: () => crypto.randomUUID(),
  });
}

export type RangerTrialClientResult<T> =
  | ({ ok: true } & T)
  | { ok: false; code: GameSessionErrorCode; message: string };

function fail(error: unknown): RangerTrialClientResult<never> {
  if (error instanceof GameSessionError) {
    console.error("[ranger-trial]", error.code, error.details);
    return {
      ok: false,
      code: error.code,
      message: GAME_SESSION_USER_MESSAGES[error.code],
    };
  }
  console.error("[ranger-trial]", error);
  return {
    ok: false,
    code: "SESSION_START_FAILED",
    message: GAME_SESSION_USER_MESSAGES.SESSION_START_FAILED,
  };
}

export async function startRangerTrialSession(): Promise<
  RangerTrialClientResult<StartRangerTrialResult>
> {
  try {
    const value = await controller().start();
    return { ok: true, ...value };
  } catch (error) {
    return fail(error);
  }
}

export async function submitRangerTrialAction(input: {
  sessionId: string;
  taskId: string;
  intent: StudentActionIntent;
  responseTimeMs: number | null;
}): Promise<RangerTrialClientResult<SubmitRangerTrialResult>> {
  try {
    const value = await controller().submit(input);
    return { ok: true, ...value };
  } catch (error) {
    if (error instanceof GameSessionError) {
      return {
        ok: false,
        code: error.code,
        message: GAME_SESSION_USER_MESSAGES[error.code],
      };
    }
    console.error("[ranger-trial]", error);
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: GAME_SESSION_USER_MESSAGES.NETWORK_ERROR,
    };
  }
}

export async function continueRangerTrialSession(
  sessionId: string,
): Promise<RangerTrialClientResult<ContinueRangerTrialResult>> {
  try {
    const value = await controller().continue(sessionId);
    return { ok: true, ...value };
  } catch (error) {
    return fail(error);
  }
}

export async function resumeRangerTrialSession(
  sessionId: string,
): Promise<RangerTrialClientResult<ResumeRangerTrialResult>> {
  try {
    const value = await controller().resume(sessionId);
    return { ok: true, ...value };
  } catch (error) {
    if (error instanceof GameSessionError && error.code === "SESSION_NOT_FOUND") {
      return {
        ok: false,
        code: "SESSION_NOT_FOUND",
        message: GAME_SESSION_USER_MESSAGES.SESSION_NOT_FOUND,
      };
    }
    return fail(error);
  }
}
