import { NextResponse } from "next/server";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { DEFAULT_LEARNING_POLICY } from "@/domain/learning/policies/default-learning-policy";
import { createInitialStudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import {
  getMemoryFreePracticeRuntimeForTests,
  resetMemoryFreePracticeRuntimeForTests,
} from "@/server/free-practice/create-free-practice-runtime";
import { freePracticeMemoryDataset } from "@/server/free-practice/memory-vocabulary";
import { isFreePracticeE2eProbeEnabled } from "@/server/free-practice/runtime-policy";

/**
 * Playwright-only memory inspection and seeding. Never expose AnswerKey.
 * Closed unless the explicit local/E2E probe gate is open.
 */
export async function GET(): Promise<NextResponse> {
  if (!isFreePracticeE2eProbeEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const runtime = getMemoryFreePracticeRuntimeForTests();
  const evidence = runtime?.learning.listEvidenceForUser(runtime.userId) ?? [];
  return NextResponse.json({
    ok: true,
    evidenceCount: evidence.length,
    items: evidence.map((item) => ({
      taskId: item.taskId,
      sessionId: item.sessionId,
      gameId: item.gameId,
      outcome: item.outcome,
      lexemeId: item.lexemeId,
    })),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isFreePracticeE2eProbeEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  let body: { op?: string; count?: number } = {};
  try {
    body = (await request.json()) as { op?: string; count?: number };
  } catch {
    body = {};
  }
  if (body.op === "reset" || !body.op) {
    resetMemoryFreePracticeRuntimeForTests();
    return NextResponse.json({ ok: true, reset: true });
  }
  if (body.op === "seed-seen") {
    const runtime = getMemoryFreePracticeRuntimeForTests();
    if (!runtime) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    const count = Number.isInteger(body.count) ? Number(body.count) : 0;
    const now = new Date().toISOString();
    for (const lexeme of freePracticeMemoryDataset().lexemes.slice(
      0,
      Math.max(0, count),
    )) {
      const model = createInitialStudentLexemeModel({
        id: crypto.randomUUID(),
        userId: runtime.userId,
        lexemeId: lexeme.id,
        now,
        policyVersion: DEFAULT_LEARNING_POLICY.version,
      });
      model.masteryStage = MasteryStage.EXPOSED;
      await runtime.learning.saveStudentLexemeModel(model);
    }
    return NextResponse.json({ ok: true, seeded: Math.max(0, count) });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
