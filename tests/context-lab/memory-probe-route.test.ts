import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/play/context-lab/memory-probe/route";
import {
  createContextLabRuntime,
  getMemoryContextLabStoresForTests,
  resetMemoryContextLabRepositoryForTests,
} from "@/server/context-lab/create-context-lab-runtime";
import { isContextLabE2eProbeEnabled } from "@/server/context-lab/is-context-lab-e2e-probe-enabled";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";

afterEach(() => {
  resetMemoryContextLabRepositoryForTests();
  vi.unstubAllEnvs();
});

const ALLOWED_PROBE_ENV = {
  CONTEXT_LAB_ENABLED: "1",
  CONTEXT_LAB_RUNTIME: "memory",
  CONTEXT_LAB_E2E_PROBE_ENABLED: "1",
} as const;

function stubProbeEnv(env: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value ?? "");
  }
}

describe("Context Lab memory probe gate", () => {
  it("memory + Context Lab enabled without the probe flag is 404 and POST does not clear stores", async () => {
    stubProbeEnv({
      CONTEXT_LAB_ENABLED: "1",
      CONTEXT_LAB_RUNTIME: "memory",
      CONTEXT_LAB_E2E_PROBE_ENABLED: "",
      CONTEXT_LAB_E2E: "",
    });
    const seeded = createContextLabRuntime();
    const screen = await seeded.createController().start();
    expect(screen.kind === "PROBE_INTRO" || screen.kind === "GUIDED").toBe(true);
    expect(getMemoryContextLabStoresForTests()).not.toBeNull();

    expect(isContextLabE2eProbeEnabled()).toBe(false);
    const getResponse = await GET();
    const postResponse = await POST();
    expect(getResponse.status).toBe(404);
    expect(postResponse.status).toBe(404);
    expect(await getResponse.json()).toEqual({ ok: false });
    expect(await postResponse.json()).toEqual({ ok: false });

    if (screen.kind !== "PROBE_INTRO" && screen.kind !== "GUIDED") {
      throw new Error("started");
    }
    const stored = await seeded.contextRuns.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored).not.toBeNull();
  });

  it("flag on in an explicit local/test environment exposes the probe", async () => {
    stubProbeEnv(ALLOWED_PROBE_ENV);
    expect(isContextLabE2eProbeEnabled()).toBe(true);
    const getResponse = await GET();
    expect(getResponse.status).toBe(200);
    const body = await getResponse.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("evidenceCount");
    expect(JSON.stringify(body)).not.toContain("answerKey");
    expect(JSON.stringify(body)).not.toContain("exactAcceptedTexts");

    const postResponse = await POST();
    expect(postResponse.status).toBe(200);
    expect(await postResponse.json()).toEqual({ ok: true, reset: true });
  });

  it("deployed hosts stay 404 even when the probe flag is on", async () => {
    stubProbeEnv({
      ...ALLOWED_PROBE_ENV,
      VERCEL_ENV: "production",
    });
    expect(isContextLabE2eProbeEnabled()).toBe(false);
    expect((await GET()).status).toBe(404);
    expect((await POST()).status).toBe(404);

    stubProbeEnv({
      ...ALLOWED_PROBE_ENV,
      VERCEL_ENV: "",
      VERCEL: "1",
    });
    expect(isContextLabE2eProbeEnabled()).toBe(false);
    expect((await GET()).status).toBe(404);
  });

  it("Supabase runtime is always 404", async () => {
    stubProbeEnv({
      CONTEXT_LAB_ENABLED: "1",
      CONTEXT_LAB_RUNTIME: "supabase",
      CONTEXT_LAB_E2E_PROBE_ENABLED: "1",
    });
    expect(isContextLabE2eProbeEnabled()).toBe(false);
    expect((await GET()).status).toBe(404);
    expect((await POST()).status).toBe(404);
  });

  it("production Node without an explicit E2E host stays closed", async () => {
    stubProbeEnv({
      ...ALLOWED_PROBE_ENV,
      NODE_ENV: "production",
      CONTEXT_LAB_E2E: "",
    });
    expect(isContextLabE2eProbeEnabled()).toBe(false);
    expect((await GET()).status).toBe(404);
    expect((await POST()).status).toBe(404);
  });
});
