import { describe, expect, it } from "vitest";
import { fingerprintAuthoredPack } from "@/contextual-learning/candidate-v0/content/content-fingerprint";
import { MEAL_SCENE_EXPANSION_BATCH_03_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-03";
import { projectLearnerLexicalForm } from "@/contextual-learning/candidate-v0/content/project-learner-lexical-form";
import { spellingCueFromAnswerForm } from "@/contextual-learning/candidate-v0/strengthen/spelling-cue";
import { BUNDLED_LEXEME_BINDINGS } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";

describe("learner lexical-form projection", () => {
  it("projects knife answerForm without the plural annotation", () => {
    const knife = bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.knife.canonicalKey)!;
    expect(knife.lemma).toBe("knife(pl.knives)");
    expect(knife.display).toBe("knife(pl.knives)");
    const projected = projectLearnerLexicalForm(knife);
    expect(projected).toEqual({
      ok: true,
      answerForm: "knife",
      displayForm: "knife",
      inflectionNote: "复数 knives",
      source: "IRREGULAR_PLURAL_NOTE",
    });
    expect(projected.ok && projected.displayForm.includes("(pl.")).toBe(false);
    expect(spellingCueFromAnswerForm(projected.ok ? projected.answerForm : "")).toBe(
      "k _ _ _ _",
    );
  });

  it("keeps plain Meal lemmas unchanged", () => {
    for (const token of ["soup", "bowl", "spoon", "fork", "cup", "plate", "bread", "water"] as const) {
      const lexeme = bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS[token].canonicalKey)!;
      const projected = projectLearnerLexicalForm(lexeme);
      expect(projected.ok).toBe(true);
      if (!projected.ok) {
        continue;
      }
      expect(projected.answerForm).toBe(token);
      expect(projected.displayForm).toBe(token);
      expect(projected.inflectionNote).toBeNull();
    }
    expect(spellingCueFromAnswerForm("bread")).toBe("b _ _ _ _");
    expect(spellingCueFromAnswerForm("water")).toBe("w _ _ _ _");
    expect(spellingCueFromAnswerForm("spoon")).toBe("s _ _ _ _");
    expect(spellingCueFromAnswerForm("bowl")).toBe("b _ _ _");
  });

  it("does not put annotations into a cue and fail-closes without an answer form", () => {
    expect(spellingCueFromAnswerForm("knife(pl.knives)")).toBeNull();
    expect(spellingCueFromAnswerForm("k _ _ _ _")).toBeNull();
    expect(spellingCueFromAnswerForm("")).toBeNull();
    expect(projectLearnerLexicalForm({ lemma: "email/e-mail" }).ok).toBe(false);
    expect(projectLearnerLexicalForm({ lemma: "exam (=examination)" }).ok).toBe(false);
    expect(projectLearnerLexicalForm({ lemma: "would (will的过去时)" }).ok).toBe(false);
    expect(projectLearnerLexicalForm({ lemma: "" }).ok).toBe(false);
  });

  it("does not change authored pack fingerprints", () => {
    const before = fingerprintAuthoredPack(MEAL_SCENE_EXPANSION_BATCH_03_PACK);
    expect(projectLearnerLexicalForm({ lemma: "knife(pl.knives)" }).ok).toBe(true);
    expect(fingerprintAuthoredPack(MEAL_SCENE_EXPANSION_BATCH_03_PACK)).toBe(before);
  });
});
