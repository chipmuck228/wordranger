import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import {
  EMPTY_TARGET_SEED_GENERATOR_VERSION,
  EMPTY_TARGET_SEED_RELATIVE_PATH,
  EXPECTED_LEXEME_COUNT,
  EXPECTED_RELATION_COUNT,
  EXPECTED_SOURCE_ENTRY_COUNT,
  EXPECTED_TAG_COUNT,
  EXPECTED_VOCABULARY_CONTENT_FINGERPRINT,
  LEARNER_ZERO_TABLES,
  REMOTE_EMPTY_TARGET_SEED_APPLY_NOT_AUTHORIZED,
  VOCABULARY_SEED_TABLES,
  generateDedicatedVocabularySeedSql,
  parseSeedCliArgs,
  runDedicatedVocabularySeedCli,
} from "@/server/vocabulary/import/empty-target-vocabulary-seed";
import {
  VOCABULARY_CONTENT_FINGERPRINT_VERSION,
  effectiveVocabularyImportRows,
} from "@/server/vocabulary/import/rebuild-contract";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";

const DOC = "docs/DEDICATED_WORDRANGER_VOCABULARY_EMPTY_TARGET_SEED.md";
const GENERATOR =
  "src/server/vocabulary/import/empty-target-vocabulary-seed.ts";
const SCRIPT = "scripts/generate-dedicated-vocabulary-seed.ts";
const LIVE = "tests/persistence/dedicated-vocabulary-empty-target-seed.live.ts";
const LIVE_GATE =
  "tests/persistence/dedicated-vocabulary-empty-target-seed-live-gate.ts";
const LIVE_CONFIG = "vitest.vocabulary-empty-target-seed.config.ts";
const DEFAULT_VITEST = "vitest.config.ts";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const BASELINE_SHA256 =
  "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe";
const PRODUCTION_ALIAS =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";

const FORBIDDEN_SQL =
  /\b(delete|truncate|update|merge|upsert|on conflict|schema_migrations|repair|db push|postgrest|copy from)\b/i;
const FORBIDDEN_SECRET =
  /https?:\/\/|supabase\.co|eyj|postgres:\/\/|@[a-z0-9.-]+\.[a-z]{2,}|\/users\/|\/tmp\/|\/private\/tmp\//i;

function read(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

function sha256(relative: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), relative)))
    .digest("hex");
}

function statementBody(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

function withoutStringLiterals(sql: string): string {
  return sql.replace(/'(?:''|[^'])*'/g, "''");
}

function topLevelKeywords(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line === "begin;" || line === "commit;");
}

describe("dedicated empty-target vocabulary seed candidate", () => {
  const sql = read(EMPTY_TARGET_SEED_RELATIVE_PATH);
  const body = statementBody(sql);
  const doc = read(DOC);
  const generator = read(GENERATOR);
  const script = read(SCRIPT);
  const live = read(LIVE);
  const liveConfig = read(LIVE_CONFIG);
  const defaultVitest = read(DEFAULT_VITEST);

  it("keeps the seed outside the active migration lineage", () => {
    expect(EMPTY_TARGET_SEED_RELATIVE_PATH.startsWith("supabase/seeds/")).toBe(
      true,
    );
    expect(EMPTY_TARGET_SEED_RELATIVE_PATH.includes("migrations")).toBe(false);
    expect(BASELINE.endsWith("202609260001_dedicated_wordranger_baseline_v0.sql")).toBe(
      true,
    );
    expect(read(BASELINE)).toContain("consolidated production baseline V0");
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);
    expect(sql).not.toContain("schema_migrations");
    expect(generator).not.toContain("supabase/migrations/");
  });

  it("locks one transaction, service_role, and insert-only writes", () => {
    expect(sql.startsWith("-- Dedicated WordRanger empty-target")).toBe(true);
    expect(body.trimStart()).toMatch(/^begin;/);
    expect(body.trimEnd()).toMatch(/commit;$/);
    expect(topLevelKeywords(sql)).toEqual(["begin;", "commit;"]);
    const roleAt = sql.indexOf("set local role service_role;");
    const firstInsert = sql.indexOf("insert into public.vocabulary_source_entries");
    expect(roleAt).toBeGreaterThan(sql.indexOf("begin;"));
    expect(firstInsert).toBeGreaterThan(roleAt);
    expect(sql.indexOf("insert into public.lexemes")).toBeGreaterThan(firstInsert);
    expect(sql.indexOf("insert into public.lexeme_relations")).toBeGreaterThan(
      sql.indexOf("insert into public.lexemes"),
    );
    expect(sql.indexOf("insert into public.lexeme_tags")).toBeGreaterThan(
      sql.indexOf("insert into public.lexeme_relations"),
    );
    for (const table of VOCABULARY_SEED_TABLES) {
      expect(sql).toContain(`insert into public.${table}`);
    }
    for (const table of LEARNER_ZERO_TABLES) {
      expect(sql).toContain(`(select count(*) from public.${table})`);
      expect(sql).not.toContain(`insert into public.${table}`);
    }
    expect(withoutStringLiterals(body)).not.toMatch(FORBIDDEN_SQL);
    expect(sql).not.toMatch(FORBIDDEN_SECRET);
    expect(sql).toContain(REMOTE_EMPTY_TARGET_SEED_APPLY_NOT_AUTHORIZED);
    expect(sql).toContain(EMPTY_TARGET_SEED_GENERATOR_VERSION);
    expect(sql).toContain(VOCABULARY_CONTENT_FINGERPRINT_VERSION);
    expect(sql).toContain(EXPECTED_VOCABULARY_CONTENT_FINGERPRINT);
    expect(sql).toContain(`source_entries=${EXPECTED_SOURCE_ENTRY_COUNT}`);
  });

  it("reuses the mapper final abbreviation values and expected counts", () => {
    const effective = effectiveVocabularyImportRows(
      toVocabularyImportRows(loadVocabularyDataset()),
    );
    expect(effective.sourceEntries).toHaveLength(EXPECTED_SOURCE_ENTRY_COUNT);
    expect(effective.lexemes).toHaveLength(EXPECTED_LEXEME_COUNT);
    expect(effective.relations).toHaveLength(EXPECTED_RELATION_COUNT);
    expect(effective.tags).toHaveLength(EXPECTED_TAG_COUNT);
    const abbreviated = effective.lexemes.filter(
      (row) => row.abbreviation_of_lexeme_id,
    );
    expect(abbreviated.length).toBeGreaterThan(0);
    const first = abbreviated[0]!;
    expect(sql).toContain(String(first.abbreviation_of_lexeme_id));
    expect(sql).not.toContain("lexemeAbbreviationUpdates");
  });

  it("locks the two proof layers and closed remote apply", () => {
    expect(doc).toMatch(/Candidate \/ Not a Standard/);
    expect(doc).toContain(REMOTE_EMPTY_TARGET_SEED_APPLY_NOT_AUTHORIZED);
    expect(doc).toContain("REMOTE_SEED_APPLIED_AND_COUNTS_VERIFIED");
    expect(doc).toContain("DIRECT_POSTGRES_REMOTE_RUNNER_PATH_RETIRED");
    expect(doc).toContain("EMPTY_TARGET_DASHBOARD_SEED_IS_CURRENT_CANDIDATE");
    expect(doc).toContain("REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED");
    expect(doc).toContain("did **not** use the Dashboard SQL Editor");
    expect(doc).toContain(VOCABULARY_CONTENT_FINGERPRINT_VERSION);
    expect(doc).toContain(EXPECTED_VOCABULARY_CONTENT_FINGERPRINT);
    expect(doc).toContain(String(EXPECTED_SOURCE_ENTRY_COUNT));
    expect(doc).toContain(String(EXPECTED_LEXEME_COUNT));
    expect(doc).toContain(String(EXPECTED_RELATION_COUNT));
    expect(doc).toContain(String(EXPECTED_TAG_COUNT));
    expect(doc).toContain(PRODUCTION_ALIAS);
    expect(doc).toContain(ORIGIN_MAIN);
    expect(doc).toContain("- [ ] Confirm the target is the Dedicated WordRanger project");
    expect(doc).toContain("Correct counts are not content correctness");
    expect(doc).not.toMatch(FORBIDDEN_SECRET);
    expect(doc).not.toMatch(/\[[xX]\]/);
  });

  it("keeps the generator offline and default Vitest isolated from live", () => {
    expect(parseSeedCliArgs(["--check"])).toBe("check");
    expect(parseSeedCliArgs(["--write"])).toBe("write");
    expect(parseSeedCliArgs([])).toBe("usage");
    expect(script).toContain("runDedicatedVocabularySeedCli(process.argv.slice(2))");
    expect(generator).not.toMatch(
      /process\.env\.(SUPABASE_|POSTGRES_|VERCEL_|DATABASE_URL|DIRECT_URL|PG)/,
    );
    expect(script).not.toContain(".env.local");
    expect(generator).not.toContain(".env.local");
    expect(defaultVitest).toContain('include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]');
    expect(defaultVitest).not.toContain(".live.ts");
    expect(liveConfig).toContain(
      "tests/persistence/dedicated-vocabulary-empty-target-seed.live.ts",
    );
    expect(live).toContain("RUN_DEDICATED_VOCABULARY_EMPTY_TARGET_SEED");
    expect(read(LIVE_GATE)).toContain("RUN_DEDICATED_VOCABULARY_EMPTY_TARGET_SEED");
  });

  it("makes --check match the committed artifact twice", () => {
    const first = generateDedicatedVocabularySeedSql();
    const second = generateDedicatedVocabularySeedSql();
    expect(first.sql).toBe(sql);
    expect(second.sql).toBe(first.sql);
    expect(first.seedSha256).toBe(second.seedSha256);
    expect(first.fingerprint).toBe(EXPECTED_VOCABULARY_CONTENT_FINGERPRINT);
    const logs: string[] = [];
    const checked = runDedicatedVocabularySeedCli(["--check"], {
      log: (value) => logs.push(value),
      error: (value) => logs.push(value),
    });
    expect(checked.exitCode).toBe(0);
    expect(checked.code).toBe("DEDICATED_VOCABULARY_SEED_CHECK_OK");
    expect(checked.seedSha256).toBe(first.seedSha256);
    expect(logs.join("\n")).toContain("DEDICATED_VOCABULARY_SEED_CHECK_OK");
    expect(logs.join("\n")).not.toContain("learning_evidence");
  });
});
