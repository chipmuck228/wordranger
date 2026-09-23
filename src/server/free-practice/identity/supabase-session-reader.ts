import "server-only";

import { createServerClient } from "@supabase/ssr";
import { isFreePracticeAuthConfigured } from "./runtime";
import type { FreePracticeSessionRead } from "./types";

export interface SupabaseAuthUserLookupResult {
  user: { id: string; is_anonymous?: boolean | null } | null;
  error: { message?: string } | null;
}

export interface ReadFreePracticeSupabaseSessionOptions {
  env?: Record<string, string | undefined>;
  getUser?: () => Promise<SupabaseAuthUserLookupResult>;
}

/**
 * Reads the official Supabase Auth user from a cookie-backed session.
 * Uses the anon key only. Never uses the service-role key.
 * Callers should treat lookup failures as no session — do not leak errors.
 */
export async function readFreePracticeSupabaseSession(
  options: ReadFreePracticeSupabaseSessionOptions = {},
): Promise<FreePracticeSessionRead> {
  const env = options.env ?? process.env;
  if (!isFreePracticeAuthConfigured(env)) {
    return { status: "NONE" };
  }

  try {
    const lookup = options.getUser ?? defaultSupabaseGetUser(env);
    const { user, error } = await lookup();
    if (error) {
      return { status: "INVALID" };
    }
    if (!user?.id) {
      return { status: "NONE" };
    }
    return {
      status: "AUTHENTICATED",
      user: {
        id: user.id,
        isAnonymous: user.is_anonymous === true,
      },
    };
  } catch {
    return { status: "INVALID" };
  }
}

function defaultSupabaseGetUser(
  env: Record<string, string | undefined>,
): () => Promise<SupabaseAuthUserLookupResult> {
  return async () => {
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return { user: null, error: { message: "missing" } };
    }

    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const client = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const cookie of cookiesToSet) {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          } catch {
            // Server Components cannot persist refreshed cookies.
          }
        },
      },
    });

    const { data, error } = await client.auth.getUser();
    return { user: data.user, error };
  };
}
