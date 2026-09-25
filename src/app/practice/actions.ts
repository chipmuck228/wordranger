"use server";

import { getFreePracticeController } from "@/server/free-practice/create-free-practice-runtime";
import type { FreePracticeSessionPublicResult } from "@/server/free-practice/public-dto";
import type { StudentActionIntent } from "@/server/game-session/learning-game-session.types";

function unavailable(): FreePracticeSessionPublicResult {
  return { status: "UNAVAILABLE", reason: "AUTH_NOT_CONFIGURED" };
}

function controller() {
  return getFreePracticeController();
}

export async function startFreePractice(input: {
  source: "UNSEEN" | "RECENTLY_INCORRECT";
  requestedCount: 5 | 10;
}): Promise<FreePracticeSessionPublicResult> {
  const active = controller();
  if (!active) {
    return unavailable();
  }
  return active.start({
    source: input.source,
    requestedCount: input.requestedCount,
  });
}

export async function loadFreePracticeSession(input: {
  sessionId: string;
}): Promise<FreePracticeSessionPublicResult> {
  const active = controller();
  if (!active) {
    return unavailable();
  }
  return active.load(input.sessionId);
}

export async function submitFreePracticeIntent(input: {
  sessionId: string;
  revision: number;
  taskId: string;
  intent: StudentActionIntent;
  responseTimeMs?: number | null;
}): Promise<FreePracticeSessionPublicResult> {
  const active = controller();
  if (!active) {
    return unavailable();
  }
  return active.submit({
    sessionId: input.sessionId,
    revision: input.revision,
    taskId: input.taskId,
    intent: input.intent,
    responseTimeMs: input.responseTimeMs,
  });
}

export async function continueFreePractice(input: {
  sessionId: string;
  revision: number;
  taskId: string;
}): Promise<FreePracticeSessionPublicResult> {
  const active = controller();
  if (!active) {
    return unavailable();
  }
  return active.continue({
    sessionId: input.sessionId,
    revision: input.revision,
    taskId: input.taskId,
  });
}
