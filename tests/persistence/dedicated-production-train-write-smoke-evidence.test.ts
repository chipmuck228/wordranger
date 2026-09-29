import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_PRODUCTION_TRAIN_WRITE_SMOKE_EVIDENCE.md";
const DATABASE = "docs/DATABASE.md";
const ORIGIN_MAIN =
  "464343095d92805e58d57a7dba9831cb1e7e6899";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

describe("dedicated production /train write smoke evidence", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");
  const database = readFileSync(path.join(process.cwd(), DATABASE), "utf8");

  it("locks smoke identities without secrets or payload", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain("Local evidence record of one authorized");
    expect(text).toContain("Production `/train` write smoke");
    expect(text).toContain("does not rerun that smoke");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain("PRODUCTION_TRAIN_WRITE_SMOKE_COMPLETED");
    expect(text).toContain("ONE_START_ONE_FIRST_PLAYABLE_SUBMIT");
    expect(text).toContain("CANARY_SESSION_TASK_EVIDENCE_DELTA_PLUS_ONE");
    expect(text).toContain("REFRESH_RESTORED_AWAITING_CONTINUE");
    expect(text).toContain("DUPLICATE_SUBMIT_DID_NOT_ADD_EVIDENCE");
    expect(text).toContain("OWNERSHIP_AND_NO_ANSWER_KEY_LEAK_VERIFIED");
    expect(text).toContain("APPEND_ONLY_CANARY_RETAINED");
    expect(text).toContain("FIRST_PLANNED_NEED_SKIPPED_THEN_RECOVERED");
    expect(text).toContain("SKIP_CLASS_GENERATION_CONSTRAINT");
    expect(text).toContain("SKIP_CODE_CONTENT_POLICY_BLOCKED");
    expect(text).toContain("NOT_DATA_GAP");
    expect(text).toContain("NOT_TRANSIENT_RUNTIME_ERROR");
    expect(text).toContain("VERCEL_FUNCTION_LOGS_NO_ERROR");
    expect(text).toContain(
      "GENERATION_FAILURE_NOT_LOGGED_AS_RUNTIME_ERROR",
    );
    expect(text).toContain("REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED");
    expect(text).toContain("NO_SECOND_SMOKE");
    expect(text).toContain("NO_CONTINUE");
    expect(text).toContain("NO_TABLE_CLEAR");
    expect(text).toContain("Did not read a local dotenv file");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain("SELECT_ONLY_POSTCHECK");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(/lcjysnyb/i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(text).not.toMatch(/\blemma\b/i);
    expect(text).not.toContain(".env.local");
    expect(text).not.toContain("supabase/.temp");
  });

  it("locks one-start shape, deltas, skip class, and non-claims", () => {
    expect(text).toContain("Executed exactly once on public `/train`");
    expect(text).toContain("Click start once");
    expect(text).toContain("Submit the first playable question once");
    expect(text).toContain("Do not click continue");
    expect(text).toContain("| `game_sessions` | `6` | `7` | `+1` |");
    expect(text).toContain("| `learning_tasks` | `38` | `39` | `+1` |");
    expect(text).toContain("| `learning_evidence` | `37` | `38` | `+1` |");
    expect(text).toContain("| `student_lexeme_models` | `34` | `35` | `+1` |");
    expect(text).toContain(
      "| `student_lexeme_skill_states` | `204` | `210` | `+6` |",
    );
    expect(text).toContain(
      "| `student_lexeme_weaknesses` | `1` | `2` | `+1` |",
    );
    expect(text).toContain("already non-zero before this smoke");
    expect(text).toContain("`phase` is `awaiting_continue`");
    expect(text).toContain("task count for that session is `1`");
    expect(text).toContain("Evidence count for that session is `1`");
    expect(text).toContain("TASK_ALREADY_COMPLETED");
    expect(text).toContain("`2 / 8`");
    expect(text).toContain("`SKIPPED`, `COMPLETED`, then six `PLANNED`");
    expect(text).toContain("WEAKNESS");
    expect(text).toContain("SLOW_RESPONSE");
    expect(text).toContain("MEANING_CHOICE");
    expect(text).toContain("CONTENT_POLICY_BLOCKED");
    expect(text).toContain("GENERATION_CONSTRAINT");
    expect(text).toContain("CONFUSABLE_CHOICE");
    expect(text).toContain("avoidRecentTaskTypes");
    expect(text).toContain("This skip is allowed session recovery");
    expect(text).toContain("not a Dedicated vocabulary-row gap");
    expect(text).toContain("not a temporary network or runtime crash");
    expect(text).toContain("later isolated fix, not a second smoke");
    expect(text).toContain("Append-only Evidence was not deleted");
    expect(text).toContain("does not close Dedicated migration by itself");
    expect(text).toContain("does not enable Free Practice identity work");
    expect(text).toContain("not a remote TypeScript fingerprint");
    expect(text).not.toMatch(/remote TypeScript fingerprint verified/i);
    expect(text).not.toMatch(/this document authorizes merge/i);
    expect(text).not.toMatch(/Dedicated migration is closed/i);
    expect(database).toContain(EVIDENCE);
    expect(database).toContain("authorized Production `/train` write smoke");
    expect(database).toContain("APPEND_ONLY_CANARY_RETAINED");
    expect(database).toContain("REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED");
  });
});
