import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { buildVocabularySeedManifest } from "@/server/vocabulary/import/rebuild-contract";

const PLAN =
  "docs/DEDICATED_WORDRANGER_BASELINE_V0_REMOTE_APPLY_PLAN.md";
const CHECKLIST =
  "docs/DEDICATED_WORDRANGER_BASELINE_V0_APPLY_CHECKLIST.md";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";

const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const PR_HEAD = "bb6e522e4db350ca915dade672cbed786f6a7bd1";
const BASELINE_SHA256 =
  "0ca22a8adba187ad4cc9255d357ab4c9da94dbc2e0a401fe65e6afc73e096b35";
const PRODUCTION_ALIAS = "782ffcca670c";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const IMPORTER_COMMIT = "82a9eccfa8cdf6e6e2ed89322742a5cef6e3a46b";
const FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";

const IMPORTER_FILES = {
  "src/server/vocabulary/import/import-rows.ts":
    "44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36",
  "src/server/vocabulary/import/rebuild-contract.ts":
    "b39ea86209bee55c7659a3ad1f4261bb708ed23fd9d104cf120f07b63ea825cb",
  "src/server/vocabulary/import/plan-import.ts":
    "63bca2c8a7f265da69fd03c8a455b7d10827cce1f702ca906efbd4a8cbc00b08",
  "scripts/import-vocabulary.ts":
    "660faf1e2bc8f1502249a998ed9ef15caeb644a807d56192d48e6f46a9109a84",
} as const;

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

const docs = [PLAN, CHECKLIST].map((file) => ({
  file,
  text: readFileSync(path.join(process.cwd(), file), "utf8"),
}));

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

function allText(): string {
  return docs.map((item) => item.text).join("\n");
}

describe("dedicated baseline V0 remote apply plan", () => {
  it("is a plan-only document without secrets, URLs, or apply claims", () => {
    for (const { file, text } of docs) {
      expect(text, file).toMatch(/Candidate \/ Not a Standard/);
      expect(text, file).not.toMatch(/https?:\/\//i);
      expect(text, file).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
      expect(text, file).not.toMatch(/lcjysnyb/i);
      expect(
        text.split("SUPABASE_SERVICE_ROLE_KEY").join(""),
        file,
      ).not.toMatch(/service_role_key/i);
      expect(text, file).not.toMatch(UUID_RE);
      expect(text, file).not.toMatch(/schema baseline applied/i);
      expect(text, file).not.toMatch(/learner rows imported/i);
      expect(text, file).not.toMatch(/PR #17 was merged/i);
      expect(text, file).not.toMatch(/this document authorizes/i);
    }
  });

  it("locks the exact baseline path, SHA, PR head, and vocabulary identity", () => {
    const manifest = buildVocabularySeedManifest(loadVocabularyDataset());
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);
    expect(manifest.algorithmVersion).toBe("vocabulary-content-v1");
    expect(manifest.fingerprint).toBe(FINGERPRINT);
    expect(manifest.sourceEntries).toBe(1600);
    expect(manifest.lexemes).toBe(1638);
    expect(manifest.relations).toBe(716);
    expect(manifest.tags).toBe(1638);
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);

    for (const { file, text } of docs) {
      expect(text, file).toContain(BASELINE);
      expect(text, file).toContain(BASELINE_SHA256);
      expect(text, file).toContain(PR_HEAD);
      expect(text, file).toContain(ORIGIN_MAIN);
      expect(text, file).toContain("vocabulary-content-v1");
      expect(text, file).toContain(FINGERPRINT);
      expect(text, file).toContain("1600");
      expect(text, file).toContain("1638");
      expect(text, file).toContain("716");
      expect(text, file).toContain(PRODUCTION_ALIAS);
    }

    const plan = docs.find((item) => item.file === PLAN)?.text ?? "";
    expect(plan).toContain(PRODUCTION_ALIAS_FULL);
    expect(plan).toContain(IMPORTER_COMMIT);
    expect(plan).toContain("DEDICATED_TARGET_MATCH");
    expect(plan).toContain("TARGET_EMPTY");
    for (const [file, digest] of Object.entries(IMPORTER_FILES)) {
      expect(sha256(file)).toBe(digest);
      expect(plan).toContain(digest);
    }
  });

  it("requires Gate A then B then C then D and forbids skipping", () => {
    const all = allText();
    expect(all).toMatch(/Gate A → Gate B → Gate C → Gate D/);
    const plan = docs.find((item) => item.file === PLAN)?.text ?? "";
    const gateA = plan.indexOf("### Gate A — baseline apply");
    const gateB = plan.indexOf("### Gate B — vocabulary seed");
    const gateC = plan.indexOf("### Gate C — runtime read/write smoke");
    const gateD = plan.indexOf("### Gate D — PR merge / Production deployment");
    expect(gateA).toBeGreaterThan(-1);
    expect(gateB).toBeGreaterThan(gateA);
    expect(gateC).toBeGreaterThan(gateB);
    expect(gateD).toBeGreaterThan(gateC);
    expect(plan).toContain("Only after Gate A catalog post-check passed");
    expect(plan).toContain("Only after Gate A catalog and Gate B fingerprint both passed");
    expect(plan).toContain("Only after Gates A, B, and C have complete evidence");
    expect(plan).toContain("This plan does not merge");
    expect(plan).toContain("No automatic PR merge");
  });

  it("locks stop conditions and forbids db push, history repair, and Blaze copy", () => {
    const all = allText();
    expect(all).toContain("REQUIRED_CORE");
    expect(all).toContain("unexpected structure");
    expect(all).toContain("learner table has data");
    expect(all).toContain("partially imported");
    expect(all).toContain("Shared Blaze objects");
    expect(all).toContain("DEDICATED_TARGET_MATCH");
    expect(all).toContain("service-role server path");
    expect(all).toContain("782ffcc");
    expect(all).toMatch(/db push/);
    expect(all).toMatch(/history repair/);
    expect(all).toMatch(/forbidden|Refuse `db push`|Do not `db push`/);
    expect(all).toContain("campus");
    expect(all).toContain("enrollment");
    expect(all).toContain("newsletter");
    expect(all).toContain("traffic");
    expect(all).toContain("public.users");
    expect(all).toContain("Do not migrate learner data");
    expect(all).toContain("No automatic PR merge");
    expect(all).not.toMatch(/copy campus .* onto the dedicated target/i);
  });

  it("keeps Production alias 782ffcc as the required rollback and does not claim a deploy", () => {
    const all = allText();
    expect(all).toContain(PRODUCTION_ALIAS);
    expect(all).toMatch(/instant rollback to `782ffcc`/i);
    expect(all).toContain("POINTS_TO_DEDICATED_TARGET");
    expect(all).not.toMatch(/production cutover complete/i);
    expect(all).not.toMatch(/Vercel cutover complete/i);
    expect(all).not.toMatch(/new Production accepted/i);
  });

  it("leaves every checklist box unchecked and records that smoke was not run", () => {
    const checklist =
      docs.find((item) => item.file === CHECKLIST)?.text ?? "";
    expect(checklist).toContain("Nothing below is done");
    expect(checklist).not.toMatch(/^- \[[xX]\]/m);
    expect(checklist).toContain("This checklist does not execute smoke");
    expect(checklist).toContain("Empty-target seed + deterministic upsert");
    expect(checklist).toContain("No stale-row delete");
    expect(checklist).toContain("Refuse learner-data migration");
    expect(checklist).toContain("Refuse automatic PR merge");
  });
});
