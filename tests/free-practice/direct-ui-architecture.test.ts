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

const PRACTICE_DIR = join(process.cwd(), "src/app/practice");
const CLIENT_FILES = [
  join(PRACTICE_DIR, "free-practice-client.tsx"),
  join(process.cwd(), "src/components/free-practice/free-practice-session-storage.ts"),
];
const ACTION_FILE = join(PRACTICE_DIR, "actions.ts");

const CLIENT_FORBIDDEN = [
  "LearningRepository",
  "LearningEvidence",
  "TaskEvaluator",
  "EvidenceFactory",
  "processEvidence",
  "TaskAnswerKey",
  "FreePracticeSessionState",
  "DeterministicScheduler",
  "DefaultLearningNeedGenerator",
  "create-free-practice-runtime",
  "InMemoryFreePracticeSessionStore",
  "SupabaseFreePracticeSessionStore",
  "DefaultTaskEvaluator",
  "createLearningEvidenceFromTaskEvaluation",
];

describe("Free Practice Direct UI architecture", () => {
  it("keeps the client on public DTO, session handle, and UI input", () => {
    for (const file of CLIENT_FILES) {
      const text = readFileSync(file, "utf8");
      for (const token of CLIENT_FORBIDDEN) {
        expect(text, `${file} ${token}`).not.toContain(token);
      }
      expect(text, file).not.toContain("V1_PLACEHOLDER_USER_ID");
      expect(text, file).not.toContain("GAME_RUNTIME");
      expect(text, file).not.toContain("RANGER_TRIAL_RUNTIME");
    }
    const client = readFileSync(CLIENT_FILES[0], "utf8");
    const storage = readFileSync(CLIENT_FILES[1], "utf8");
    expect(client).toContain("DirectPracticeRenderer");
    expect(client).toContain("InlineTrainingFeedback");
    expect(storage).toContain("wordranger.free-practice.session-id");
    expect(client).toContain("hideCorrection");
  });

  it("keeps server actions as a thin controller facade", () => {
    const text = readFileSync(ACTION_FILE, "utf8");
    expect(text).toContain("getFreePracticeController");
    expect(text).toContain(".start(");
    expect(text).toContain(".load(");
    expect(text).toContain(".submit(");
    expect(text).toContain(".continue(");
    expect(text).not.toContain("DefaultTaskEvaluator");
    expect(text).not.toContain("EvidenceFactory");
    expect(text).not.toContain("processEvidence");
    expect(text).not.toContain("userId");
    expect(text).not.toContain("planFreePractice");
    expect(text).not.toContain("submitTaskAction");
  });

  it("404s when the feature flag is off and does not reuse other runtimes", () => {
    const page = readFileSync(join(PRACTICE_DIR, "page.tsx"), "utf8");
    expect(page).toContain("isFreePracticePageAvailable");
    expect(page).toContain("notFound");
    const runtime = readFileSync(
      join(process.cwd(), "src/server/free-practice/create-free-practice-runtime.ts"),
      "utf8",
    );
    const policy = readFileSync(
      join(process.cwd(), "src/server/free-practice/runtime-policy.ts"),
      "utf8",
    );
    expect(runtime).toContain('import "server-only"');
    expect(policy).toContain("FREE_PRACTICE_RUNTIME");
    expect(runtime).not.toContain("GAME_RUNTIME");
    expect(runtime).not.toContain("RANGER_TRIAL_RUNTIME");
    expect(runtime).not.toContain("createContextLabRuntime");
    expect(runtime).not.toContain("V1_PLACEHOLDER_USER_ID");
  });

  it("does not expose /practice from Homepage or /train", () => {
    const home = readFileSync(
      join(process.cwd(), "src/components/home/home-page.tsx"),
      "utf8",
    );
    const train = walk(join(process.cwd(), "src/app/train"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(home).not.toContain("/practice");
    expect(train).not.toContain("/practice");
    expect(train).not.toContain("startFreePractice");
  });
});
