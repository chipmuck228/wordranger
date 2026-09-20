import { describe, expect, it } from "vitest";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { lexemeIdFromCanonicalKey } from "@/lib/canonical-id";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
  listBundledLexemeBindings,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("contextual lexeme binding source of truth", () => {
  it("resolves every catalog binding through canonical key and bundled vocabulary", () => {
    const dataset = loadVocabularyDataset();
    for (const binding of listBundledLexemeBindings()) {
      const lexeme = dataset.lexemes.find(
        (item) => item.canonicalKey === binding.canonicalKey,
      );
      expect(lexeme, binding.canonicalKey).toBeTruthy();
      expect(lexeme?.lemma).toBe(binding.lemma);
      expect(bundledBindingLexemeId(binding)).toBe(
        lexemeIdFromCanonicalKey(binding.canonicalKey),
      );
      expect(lexeme?.id).toBe(bundledBindingLexemeId(binding));
    }
    expect(BUNDLED_LEXEME_BINDINGS.spoon.canonicalKey).toBe("lex-1311-1");
  });

  it("does not hardcode UUIDs in the Candidate binding table or Context Lab adapter", () => {
    const bindingSource = readFileSync(
      join(
        process.cwd(),
        "src/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings.ts",
      ),
      "utf8",
    );
    const adapter = readFileSync(
      join(
        process.cwd(),
        "src/server/context-lab/bind-generated-task-to-vocabulary.ts",
      ),
      "utf8",
    );
    expect(bindingSource).not.toMatch(
      /lexemeId:\s*"[0-9a-f]{8}-[0-9a-f]{4}/i,
    );
    expect(adapter).toContain("findBundledLexemeBinding");
    expect(adapter).not.toContain("MEAL_FIXTURE_LEXEME_BINDINGS");
  });
});
