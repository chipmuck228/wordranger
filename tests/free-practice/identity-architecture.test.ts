import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

const IDENTITY_DIR = join(process.cwd(), "src/server/free-practice/identity");
const CLIENT_DIRS = [
  join(process.cwd(), "src/components"),
  join(process.cwd(), "src/app/train"),
  join(process.cwd(), "src/app/play"),
  join(process.cwd(), "src/components/home"),
];

describe("Free Practice identity architecture boundary", () => {
  it("keeps every identity module server-only", () => {
    for (const file of walk(IDENTITY_DIR)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).toMatch(/import ["']server-only["']/);
      expect(text, file).not.toMatch(/processEvidence/);
      expect(text, file).not.toMatch(/DeterministicScheduler/);
      expect(text, file).not.toMatch(/DefaultTaskEvaluator/);
      expect(text, file).not.toMatch(/createLearningEvidenceFromTaskEvaluation/);
      expect(text, file).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    }
  });

  it("is not imported by student UI, /train, or Context Lab clients", () => {
    const forbidden = [
      "requireFreePracticeIdentity",
      "resolveFreePracticeIdentity",
      "createTestFreePracticeSessionReader",
      "free-practice/identity",
    ];
    for (const dir of CLIENT_DIRS) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        for (const token of forbidden) {
          expect(text, `${file} ${token}`).not.toContain(token);
        }
      }
    }
  });

  it("does not change Daily Training placeholder wiring", () => {
    const trainActions = readFileSync(
      join(process.cwd(), "src/app/train/actions.ts"),
      "utf8",
    );
    const runtime = readFileSync(
      join(process.cwd(), "src/server/runtime/create-daily-training-runtime.ts"),
      "utf8",
    );
    expect(trainActions).toContain("createDailyTrainingRuntime().createController()");
    expect(trainActions).not.toContain("requireFreePracticeIdentity");
    expect(trainActions).not.toMatch(/input\.userId|body\.userId/);
    expect(runtime).toContain("V1_PLACEHOLDER_USER_ID");
  });

  it("does not change Context Lab placeholder wiring", () => {
    const runtime = readFileSync(
      join(process.cwd(), "src/server/context-lab/create-context-lab-runtime.ts"),
      "utf8",
    );
    expect(runtime).toContain("V1_PLACEHOLDER_USER_ID");
    expect(runtime).not.toContain("requireFreePracticeIdentity");
  });

  it("uses the anon key for cookie auth, never the service role", () => {
    const reader = readFileSync(
      join(IDENTITY_DIR, "supabase-session-reader.ts"),
      "utf8",
    );
    expect(reader).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(reader).toContain("createServerClient");
    expect(reader).toContain("auth.getUser");
    expect(reader).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
