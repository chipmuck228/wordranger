import { describe, expect, it } from "vitest";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import {
  identityForFixtureSense,
  listMealStrengthenIdentities,
  resolveMealLexicalStrengthenProfiles,
} from "@/contextual-learning/candidate-v0/strengthen/meal-lexical-profiles";
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

const VOCAB: Record<string, { id: string; display: string; lemma: string; meaningsZh: string[]; ipa: string[] }> = {
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

describe("Meal lexical STRENGTHEN profiles", () => {
  it("binds four catalog identities to real UUID, sense, and entity order", () => {
    const listed = listMealStrengthenIdentities();
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      throw new Error(listed.reason);
    }
    expect(listed.identities.map((item) => item.entityId)).toEqual([
      ...HOME_BREAKFAST_SCENE_ENTITY_IDS,
    ]);
    for (const identity of listed.identities) {
      const member = MEAL_SCENE_CLUSTER.members.find(
        (item) => item.candidateFixtureLexemeId === identity.fixtureLexemeId,
      );
      expect(member?.target.lexemeId).toBe(identity.target.lexemeId);
      expect(member?.target.senseId).toBe(identity.fixtureSense.senseId);
      expect(identity.target.lexemeId).toBe(
        bundledBindingLexemeId({ canonicalKey: identity.canonicalKey }),
      );
    }
    expect(identityForFixtureSense(MEAL_SENSE.soup)?.stepToken).toBe("soup");
    expect(identityForFixtureSense({ lexemeId: "lex-soup", senseId: "guess" })).toBeNull();
  });

  it("uses real vocabulary display/meaning and omits missing IPA", () => {
    const resolved = resolveMealLexicalStrengthenProfiles({
      loadLexeme: (key) => VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: HOME_BREAKFAST_SCENE_ENTITY_IDS,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      throw new Error(resolved.reason);
    }
    expect(resolved.profiles.map((item) => item.displayForm)).toEqual([
      "soup",
      "bowl",
      "spoon",
      "fork",
    ]);
    expect(resolved.profiles[1]?.phonetic).toBeUndefined();
    expect(resolved.profiles[0]?.phonetic).toBe("/suːp/");
    expect(resolved.profiles[2]?.meaningGloss).toBe("匙，调羹");
  });

  it("fails closed on missing meaning or identity mismatch", () => {
    const missingMeaning = resolveMealLexicalStrengthenProfiles({
      loadLexeme: (key) =>
        key === "lex-1300-1" ? { ...VOCAB[key]!, meaningsZh: [] } : VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: HOME_BREAKFAST_SCENE_ENTITY_IDS,
    });
    expect(missingMeaning).toEqual({
      ok: false,
      reason: "MEAL_TARGET_PROFILE_UNRESOLVED",
    });
    const mismatch = resolveMealLexicalStrengthenProfiles({
      loadLexeme: (key) =>
        key === "lex-1300-1"
          ? { ...VOCAB[key]!, id: "00000000-0000-4000-8000-000000000099" }
          : VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: HOME_BREAKFAST_SCENE_ENTITY_IDS,
    });
    expect(mismatch.ok).toBe(false);
  });
});
