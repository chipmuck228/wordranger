import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createTimedFetch } from "@/lib/runtime/persistence-timeout";

function createTimedSupabaseClient(
  url: string,
  key: string,
): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: createTimedFetch(),
    },
  });
}

/**
 * Server-only client. Service role must never be sent to the browser.
 * All PostgREST fetches use the shared persistence timeout so a stalled
 * network cannot hang a student-game Server Action indefinitely.
 *
 * Student-game adapters may fall back to the anon key when the service
 * role is unset. Curated placement review must not use this fallback.
 */
export function createSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRoleKey ?? anonKey;
  if (!url || !key) {
    return null;
  }
  return createTimedSupabaseClient(url, key);
}

/**
 * Service-role client for internal/admin reference writes.
 * Never falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function createSupabaseServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }
  return createTimedSupabaseClient(url, serviceRoleKey);
}
