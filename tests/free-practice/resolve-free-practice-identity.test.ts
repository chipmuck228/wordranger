import { describe, expect, it } from "vitest";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { requireFreePracticeIdentity } from "@/server/free-practice/identity/require-free-practice-identity";
import { resolveFreePracticeIdentity } from "@/server/free-practice/identity/resolve-free-practice-identity";
import { readFreePracticeSupabaseSession } from "@/server/free-practice/identity/supabase-session-reader";
import { createTestFreePracticeSessionReader } from "@/server/free-practice/identity/test-session-reader";
import type { FreePracticeSessionRead } from "@/server/free-practice/identity/types";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

const AUTH_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-test-key",
};

const TEST_GATE_ENV = {
  NODE_ENV: "test",
  WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY: "1",
};

function sessionOf(
  read: FreePracticeSessionRead,
): () => Promise<FreePracticeSessionRead> {
  return async () => read;
}

describe("resolveFreePracticeIdentity", () => {
  it("returns the server userId for a valid anonymous session", async () => {
    const result = await resolveFreePracticeIdentity({
      env: AUTH_ENV,
      readSession: sessionOf({
        status: "AUTHENTICATED",
        user: { id: USER_A, isAnonymous: true },
      }),
    });
    expect(result).toEqual({
      status: "AUTHENTICATED",
      userId: USER_A,
      identityKind: "SUPABASE_ANONYMOUS",
    });
  });

  it("returns the server userId for a valid ordinary Supabase user session", async () => {
    const result = await resolveFreePracticeIdentity({
      env: AUTH_ENV,
      readSession: sessionOf({
        status: "AUTHENTICATED",
        user: { id: USER_B, isAnonymous: false },
      }),
    });
    expect(result).toEqual({
      status: "AUTHENTICATED",
      userId: USER_B,
      identityKind: "SUPABASE_USER",
    });
  });

  it("returns NO_SERVER_SESSION when the cookie session is missing", async () => {
    const result = await resolveFreePracticeIdentity({
      env: AUTH_ENV,
      readSession: sessionOf({ status: "NONE" }),
    });
    expect(result).toEqual({
      status: "UNAVAILABLE",
      reason: "NO_SERVER_SESSION",
    });
  });

  it("fails closed for an expired or corrupt session", async () => {
    const expired = await resolveFreePracticeIdentity({
      env: AUTH_ENV,
      readSession: sessionOf({ status: "INVALID" }),
    });
    const thrown = await resolveFreePracticeIdentity({
      env: AUTH_ENV,
      readSession: async () => {
        throw new Error("jwt expired access_token=super-secret");
      },
    });
    expect(expired).toEqual({
      status: "UNAVAILABLE",
      reason: "NO_SERVER_SESSION",
    });
    expect(thrown).toEqual({
      status: "UNAVAILABLE",
      reason: "NO_SERVER_SESSION",
    });
    expect(JSON.stringify(thrown)).not.toMatch(/super-secret|access_token|jwt/i);
  });

  it("rejects the shared placeholder user", async () => {
    const result = await resolveFreePracticeIdentity({
      env: AUTH_ENV,
      readSession: sessionOf({
        status: "AUTHENTICATED",
        user: { id: V1_PLACEHOLDER_USER_ID, isAnonymous: true },
      }),
    });
    expect(result).toEqual({
      status: "UNAVAILABLE",
      reason: "PLACEHOLDER_FORBIDDEN",
    });
  });

  it("ignores a client-injected userId", async () => {
    const result = await resolveFreePracticeIdentity({
      env: AUTH_ENV,
      untrustedClientPayload: { userId: USER_B, sessionId: "client-session" },
      readSession: sessionOf({
        status: "AUTHENTICATED",
        user: { id: USER_A, isAnonymous: true },
      }),
    });
    expect(result).toEqual({
      status: "AUTHENTICATED",
      userId: USER_A,
      identityKind: "SUPABASE_ANONYMOUS",
    });
  });

  it("keeps user A and user B isolated", async () => {
    const userA = await resolveFreePracticeIdentity({
      env: AUTH_ENV,
      untrustedClientPayload: { userId: USER_B },
      readSession: sessionOf({
        status: "AUTHENTICATED",
        user: { id: USER_A, isAnonymous: true },
      }),
    });
    const userB = await resolveFreePracticeIdentity({
      env: AUTH_ENV,
      untrustedClientPayload: { userId: USER_A },
      readSession: sessionOf({
        status: "AUTHENTICATED",
        user: { id: USER_B, isAnonymous: false },
      }),
    });
    expect(userA).toMatchObject({ status: "AUTHENTICATED", userId: USER_A });
    expect(userB).toMatchObject({ status: "AUTHENTICATED", userId: USER_B });
    expect(userA).not.toEqual(userB);
  });

  it("returns AUTH_NOT_CONFIGURED in production-like config gaps without fallback", async () => {
    const result = await requireFreePracticeIdentity(
      { userId: USER_A },
      { NODE_ENV: "production", VERCEL: "1" },
    );
    expect(result).toEqual({
      status: "UNAVAILABLE",
      reason: "AUTH_NOT_CONFIGURED",
    });
  });
});

describe("readFreePracticeSupabaseSession", () => {
  it("maps an anonymous auth.getUser() result", async () => {
    const session = await readFreePracticeSupabaseSession({
      env: AUTH_ENV,
      getUser: async () => ({
        user: { id: USER_A, is_anonymous: true },
        error: null,
      }),
    });
    expect(session).toEqual({
      status: "AUTHENTICATED",
      user: { id: USER_A, isAnonymous: true },
    });
  });

  it("maps getUser errors to INVALID without exposing the token", async () => {
    const session = await readFreePracticeSupabaseSession({
      env: AUTH_ENV,
      getUser: async () => ({
        user: null,
        error: { message: "invalid JWT refresh_token=leak-me" },
      }),
    });
    expect(session).toEqual({ status: "INVALID" });
    expect(JSON.stringify(session)).not.toContain("leak-me");
  });
});

describe("createTestFreePracticeSessionReader", () => {
  it("works only when the explicit test gate is open", async () => {
    const reader = createTestFreePracticeSessionReader({
      env: TEST_GATE_ENV,
      userId: USER_A,
      isAnonymous: true,
    });
    const result = await resolveFreePracticeIdentity({
      env: TEST_GATE_ENV,
      readSession: reader,
    });
    expect(result).toMatchObject({ status: "AUTHENTICATED", userId: USER_A });
  });

  it("refuses to run on Vercel even if the test gate is set", () => {
    expect(() =>
      createTestFreePracticeSessionReader({
        env: {
          ...TEST_GATE_ENV,
          VERCEL: "1",
          VERCEL_ENV: "production",
        },
        userId: USER_A,
        isAnonymous: true,
      }),
    ).toThrow(/disabled/);
  });

  it("refuses to run without the test gate", () => {
    expect(() =>
      createTestFreePracticeSessionReader({
        env: { NODE_ENV: "test" },
        userId: USER_A,
        isAnonymous: true,
      }),
    ).toThrow(/disabled/);
  });
});
