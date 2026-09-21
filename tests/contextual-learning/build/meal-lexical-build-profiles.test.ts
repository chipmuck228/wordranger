import { describe, expect, it } from "vitest";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import {
  MEAL_BUILD_SCENE_BINDINGS,
  resolveMealLexicalBuildProfiles,
} from "@/contextual-learning/candidate-v0/build/meal-lexical-build-profiles";

const HOME_BREAKFAST_SCENE_ENTITY_IDS = [
  "home-soup",
  "home-bowl",
  "home-spoon",
  "home-fork",
] as const;

const LABELS: Record<string, string> = {
  "home-soup": "汤",
  "home-bowl": "碗",
  "home-spoon": "勺子",
  "home-fork": "叉子",
};

const VOCAB: Record<
  string,
  { id: string; display: string; lemma: string; meaningsZh: string[]; ipa: string[] }
> = {
  "lex-1300-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.soup),
    display: "soup",
    lemma: "soup",
    meaningsZh: ["汤"],
    ipa: ["/suːp/"],
  },
  "lex-0179-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.bowl),
    display: "bowl",
    lemma: "bowl",
    meaningsZh: ["碗"],
    ipa: [],
  },
  "lex-1311-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.spoon),
    display: "spoon",
    lemma: "spoon",
    meaningsZh: ["匙，调羹"],
    ipa: ["/spuːn/"],
  },
  "lex-0548-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.fork),
    display: "fork",
    lemma: "fork",
    meaningsZh: ["叉，餐叉"],
    ipa: ["/fɔːk/"],
  },
};

describe("Meal lexical BUILD profiles", () => {
  it("resolves four catalog targets with authored contrast bindings", () => {
    const resolved = resolveMealLexicalBuildProfiles({
      loadLexeme: (key) => VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: HOME_BREAKFAST_SCENE_ENTITY_IDS,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      throw new Error(resolved.reason);
    }
    expect(resolved.profiles.map((item) => item.stepToken)).toEqual([
      "soup",
      "bowl",
      "spoon",
      "fork",
    ]);
    for (const profile of resolved.profiles) {
      const binding = MEAL_BUILD_SCENE_BINDINGS[profile.stepToken];
      expect(profile.contrastEntityId).toBe(binding.contrastEntityId);
      expect(profile.displayForm).toBeTruthy();
      expect(profile.meaningGloss).toBeTruthy();
      expect(profile.displayLabel).toBeTruthy();
    }
    expect(resolved.profiles[1]?.phonetic).toBeUndefined();
    expect(resolved.profiles[0]?.phonetic).toBe("/suːp/");
  });

  it("fails closed on identity drift and missing gloss", () => {
    const drifted = resolveMealLexicalBuildProfiles({
      loadLexeme: (key) =>
        key === "lex-1300-1"
          ? { ...VOCAB[key]!, id: "other-uuid" }
          : VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: HOME_BREAKFAST_SCENE_ENTITY_IDS,
    });
    expect(drifted.ok).toBe(false);

    const missingGloss = resolveMealLexicalBuildProfiles({
      loadLexeme: (key) =>
        key === "lex-0179-1"
          ? { ...VOCAB[key]!, meaningsZh: [] }
          : VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: HOME_BREAKFAST_SCENE_ENTITY_IDS,
    });
    expect(missingGloss.ok).toBe(false);
  });
});
