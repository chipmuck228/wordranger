import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import {
  assertVocabularyRebuildMatches,
  buildVocabularyRebuildManifest,
} from "@/server/vocabulary/import/rebuild-contract";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";

describe("vocabulary rebuild contract", () => {
  it("is deterministic over bundled vocabulary and writes no learner state", () => {
    const dataset = loadVocabularyDataset();
    const first = buildVocabularyRebuildManifest(dataset);
    const second = buildVocabularyRebuildManifest(loadVocabularyDataset());
    expect(first).toEqual(second);
    expect(first.sourceEntries).toBeGreaterThan(0);
    expect(first.lexemes).toBeGreaterThan(0);
    expect(first.relations).toBeGreaterThan(0);
    expect(first.tags).toBeGreaterThan(0);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    assertVocabularyRebuildMatches(first, second);
    const rows = toVocabularyImportRows(dataset);
    expect(rows.sourceEntries).toHaveLength(first.sourceEntries);
    expect(rows.lexemes).toHaveLength(first.lexemes);
    expect(rows.relations).toHaveLength(first.relations);
    expect(rows.tags).toHaveLength(first.tags);
    const joined = JSON.stringify(rows);
    expect(joined).not.toContain("learning_evidence");
    expect(joined).not.toContain("student_lexeme_models");
    expect(joined).not.toContain("game_sessions");
  });

  it("keeps fingerprint mode offline in the existing importer", () => {
    const script = readFileSync(
      path.join(process.cwd(), "scripts/import-vocabulary.ts"),
      "utf8",
    );
    expect(script).toContain('--fingerprint');
    expect(script).toContain("buildVocabularyRebuildManifest");
    expect(script).toMatch(
      /if \(mode === "fingerprint"\)[\s\S]*return;[\s\S]*createSupabaseServerClient/,
    );
  });
});
