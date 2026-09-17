import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Load `.env.local` into process.env without overwriting existing values. */
export function loadLocalEnv(cwd = process.cwd()): void {
  const file = path.join(cwd, ".env.local");
  if (!existsSync(file)) {
    return;
  }
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const stripped = line.startsWith("export ") ? line.slice(7) : line;
    const eq = stripped.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = stripped.slice(0, eq).trim();
    let value = stripped.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function supabaseProgressConfigured(): boolean {
  loadLocalEnv();
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function supabaseProgressRunRequested(): boolean {
  return process.env.RUN_SUPABASE_PROGRESS === "1";
}

/** Live progress tests must not mutate whichever project is in `.env.local` without both flags. */
export function supabaseProgressWritesAllowed(): boolean {
  return (
    supabaseProgressRunRequested() &&
    process.env.ALLOW_SUPABASE_PROGRESS_WRITES === "1"
  );
}
