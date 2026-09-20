import { NextResponse } from "next/server";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import {
  createContextLabRuntime,
  getMemoryContextLabStoresForTests,
  resetMemoryContextLabRepositoryForTests,
} from "@/server/context-lab/create-context-lab-runtime";
import { isContextLabEnabled } from "@/server/context-lab/is-context-lab-enabled";
import { resolveContextLabRuntimeMode } from "@/server/context-lab/context-lab-runtime-mode";

/**
 * Memory-runtime inspection for Playwright. Never expose AnswerKey.
 */
export async function GET(): Promise<NextResponse> {
  if (!isMemoryProbeEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  createContextLabRuntime();
  const stores = getMemoryContextLabStoresForTests();
  const evidence = stores?.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID) ?? [];
  return NextResponse.json({
    ok: true,
    evidenceCount: evidence.length,
    items: evidence.map((item) => ({
      taskId: item.taskId,
      sessionId: item.sessionId,
      gameId: item.gameId,
      outcome: item.outcome,
    })),
  });
}

export async function POST(): Promise<NextResponse> {
  if (!isMemoryProbeEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  resetMemoryContextLabRepositoryForTests();
  return NextResponse.json({ ok: true, reset: true });
}

function isMemoryProbeEnabled(): boolean {
  if (!isContextLabEnabled()) {
    return false;
  }
  try {
    return resolveContextLabRuntimeMode() === "memory";
  } catch {
    return false;
  }
}
