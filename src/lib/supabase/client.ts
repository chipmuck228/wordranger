import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseBrowserConfig(): {
  url: string;
  anonKey: string;
} | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

export function createSupabaseBrowserClient(): SupabaseClient | null {
  const config = getSupabaseBrowserConfig();
  if (!config) {
    return null;
  }
  return createClient(config.url, config.anonKey);
}
