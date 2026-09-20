import { NextResponse } from "next/server";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import {
  createContextLabRuntime,
  getMemoryContextLabStoresForTests,
  resetMemoryContextLabRepositoryForTests,
} from "@/server/context-lab/create-context-lab-runtime";
import { isContextLabE2eProbeEnabled } from "@/server/context-lab/is-context-lab-e2e-probe-enabled";

/**
 * Playwright-only memory inspection. Never expose AnswerKey.
 * Closed unless CONTEXT_LAB_E2E_PROBE_ENABLED=1 on an explicit local/test host.
 */
export async function GET(): Promise<NextResponse> {
  if (!isContextLabE2eProbeEnabled()) {
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
  if (!isContextLabE2eProbeEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  resetMemoryContextLabRepositoryForTests();
  return NextResponse.json({ ok: true, reset: true });
}
