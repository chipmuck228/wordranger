import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_VOCABULARY_EMPTY_TARGET_SEED_APPLY_EVIDENCE.md";
const SEED = "supabase/seeds/dedicated_wordranger_vocabulary_v0.sql";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const INSPECTED_HEAD = "60e360880fe739629876fae397167f37ace9f33e";
const SEED_SHA256 =
  "2fb4c9eb6bae072cf263fa130cea72a861ee07804c9e00255766cb7261f1ad8c";
const BASELINE_SHA256 =
  "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

describe("dedicated empty-target vocabulary seed apply evidence", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");

  it("locks apply identities without secrets or payload", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain(
      "Local evidence record of one authorized",
    );
    expect(text).toContain("remote empty-target vocabulary seed apply");
    expect(text).toContain("does not rerun or alter that apply");
    expect(text).toContain("capture-time identity");
    expect(text).toContain(SEED);
    expect(text).toContain(SEED_SHA256);
    expect(sha256(SEED)).toBe(SEED_SHA256);
    expect(text).toContain(BASELINE);
    expect(text).toContain(BASELINE_SHA256);
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);
    expect(text).toContain("vocabulary-content-v1");
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain("1600 / 1638 / 716 / 1638");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(INSPECTED_HEAD);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain("REMOTE_SEED_APPLIED_AND_COUNTS_VERIFIED");
    expect(text).toContain("MIGRATION_HISTORY_UNCHANGED_AFTER_SEED");
    expect(text).toContain("REMOTE_VOCABULARY_COUNTS_VERIFIED");
    expect(text).toContain("REMOTE_LEARNER_TABLES_ZERO_VERIFIED");
    expect(text).toContain(
      "REMOTE_VOCABULARY_REFERENTIAL_INTEGRITY_VERIFIED",
    );
    expect(text).toContain("VOCAB_SERVICE_ROLE_SUI_NO_DELETE_UNCHANGED");
    expect(text).toContain("LEARNER_SECURITY_UNCHANGED_AFTER_SEED");
    expect(text).toContain(
      "NO_SHARED_OPTIONAL_OR_UNEXPECTED_OBJECTS_CREATED",
    );
    expect(text).toContain("REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED");
    expect(text).toContain("PR_17_REMAINS_DO_NOT_MERGE");
    expect(text).toContain("PRODUCTION_REMAINS_ON_782FFCC");
    expect(text).toContain("DEDICATED_API_AND_DB_MATCH");
    expect(text).toContain("LEGACY_SOURCE_EXCLUDED");
    expect(text).toContain("DEDICATED_SNAPSHOT_ELIGIBLE");
    expect(text).toContain("Did not read a local dotenv file");
    expect(text).toContain("TEMP_DELETED");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(/lcjysnyb/i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(text).not.toMatch(/\blemma\b/i);
    expect(text).not.toContain(".env.local");
    expect(text).not.toContain("supabase/.temp");
  });

  it("locks one psql -f apply, post-check classes, and non-claims", () => {
    expect(text).toContain("psql");
    expect(text).toContain("-f supabase/seeds/dedicated_wordranger_vocabulary_v0.sql");
    expect(text).toContain("Executed exactly once");
    expect(text).toContain("Dashboard SQL Editor was not used");
    expect(text).toContain("The transaction was");
    expect(text).toContain("not split");
    expect(text).toContain("no retry");
    expect(text).toContain("INSERT 0 1600");
    expect(text).toContain("INSERT 0 1638");
    expect(text).toContain("INSERT 0 716");
    expect(text).toContain("INSERT 0 1638");
    expect(text).toContain("COMMIT");
    expect(text).toContain("sslmode=verify-full");
    expect(text).toContain("| `vocabulary_source_entries` | `1600` |");
    expect(text).toContain("| `lexemes` | `1638` |");
    expect(text).toContain("| `lexeme_relations` | `716` |");
    expect(text).toContain("| `lexeme_tags` | `1638` |");
    expect(text).toContain("| `learning_tasks` | `0` |");
    expect(text).toContain("prevent_learning_evidence_mutation");
    expect(text).toContain("learning_evidence_no_update");
    expect(text).toContain("Seed apply wrote no history row");
    expect(text).toContain("No complete vocabulary readback was downloaded");
    expect(text).toContain("not a remote TypeScript fingerprint");
    expect(text).toContain("not Production runtime acceptance");
    expect(text).toContain("`/train` write smoke was not executed");
    expect(text).toContain("PR #17 remains DO NOT MERGE");
    expect(text).toContain("The seed was not executed a second time");
    expect(text).not.toMatch(/Dashboard SQL Editor was used/i);
    expect(text).not.toMatch(/remote TypeScript fingerprint verified/i);
    expect(text).not.toMatch(/PR #17 was merged/i);
    expect(text).not.toMatch(/Production was deployed/i);
    expect(text).not.toMatch(/this document authorizes merge/i);
  });
});
