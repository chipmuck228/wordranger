import { describe, expect, it } from "vitest";
import {
  resolveMealLexicalBuildProfiles,
} from "@/contextual-learning/candidate-v0/build/meal-lexical-build-profiles";
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

const FOUR_WORD_ENTITY_IDS = [
  "home-soup",
  "home-bowl",
  "home-spoon",
  "home-fork",
] as const;

const FIVE_WORD_ENTITY_IDS = [...FOUR_WORD_ENTITY_IDS, "home-cup"] as const;
const SIX_WORD_ENTITY_IDS = [...FIVE_WORD_ENTITY_IDS, "home-plate"] as const;

const FRAME_ENTITY_IDS = [
  ...SIX_WORD_ENTITY_IDS,
  "home-drink",
  "home-served-food",
] as const;

const LABELS: Record<string, string> = {
  "home-soup": "汤",
  "home-bowl": "碗",
  "home-spoon": "勺子",
  "home-fork": "叉子",
  "home-cup": "杯子",
  "home-plate": "盘子",
  "home-drink": "饮料",
  "home-served-food": "盘中食物",
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
  "lex-0346-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.cup),
    display: "cup",
    lemma: "cup",
    meaningsZh: ["茶杯"],
    ipa: ["/kʌp/"],
  },
  "lex-1036-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.plate),
    display: "plate",
    lemma: "plate",
    meaningsZh: ["板", "片", "牌", "盘子", "盆子"],
    ipa: ["/pleɪt/"],
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
      ...SIX_WORD_ENTITY_IDS,
    ]);
    expect(listed.identities.map((item) => item.entityId)).not.toContain("home-drink");
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

  it("fails closed when any expected lexical identity is outside allowedEntityIds", () => {
    const missingCup = resolveMealLexicalStrengthenProfiles({
      loadLexeme: (key) => VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: FOUR_WORD_ENTITY_IDS,
    });
    expect(missingCup).toEqual({
      ok: false,
      reason: "MEAL_TARGET_PROFILE_UNRESOLVED",
    });
  });

  it("does not treat frame-only home-drink as a Probe, BUILD, or STRENGTHEN target", () => {
    const listed = listMealStrengthenIdentities();
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      throw new Error(listed.reason);
    }
    expect(listed.identities.some((item) => item.entityId === "home-drink")).toBe(false);
    const strengthen = resolveMealLexicalStrengthenProfiles({
      loadLexeme: (key) => VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: FRAME_ENTITY_IDS,
    });
    expect(strengthen.ok).toBe(true);
    if (!strengthen.ok) {
      throw new Error(strengthen.reason);
    }
    expect(strengthen.profiles.map((item) => item.entityId)).toEqual([...SIX_WORD_ENTITY_IDS]);
    const build = resolveMealLexicalBuildProfiles({
      loadLexeme: (key) => VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: FRAME_ENTITY_IDS,
    });
    expect(build.ok).toBe(true);
    if (!build.ok) {
      throw new Error(build.reason);
    }
    expect(build.profiles.map((item) => item.entityId)).toEqual([...SIX_WORD_ENTITY_IDS]);
    expect(build.profiles.some((item) => item.entityId === "home-drink")).toBe(false);
    expect(build.profiles.some((item) => item.entityId === "home-served-food")).toBe(false);
  });

  it("resolves the six-word set and still admits cup and plate into BUILD and STRENGTHEN", () => {
    const strengthen = resolveMealLexicalStrengthenProfiles({
      loadLexeme: (key) => VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: SIX_WORD_ENTITY_IDS,
    });
    expect(strengthen.ok).toBe(true);
    if (!strengthen.ok) {
      throw new Error(strengthen.reason);
    }
    expect(strengthen.profiles.map((item) => item.displayForm)).toEqual([
      "soup",
      "bowl",
      "spoon",
      "fork",
      "cup",
      "plate",
    ]);
    expect(strengthen.profiles[1]?.phonetic).toBeUndefined();
    expect(strengthen.profiles[0]?.phonetic).toBe("/suːp/");
    expect(strengthen.profiles[2]?.meaningGloss).toBe("匙，调羹");
    expect(strengthen.profiles[4]?.entityId).toBe("home-cup");
    expect(strengthen.profiles[5]?.meaningGloss).toBe("盘子");
    const fiveOnly = resolveMealLexicalStrengthenProfiles({
      loadLexeme: (key) => VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: FIVE_WORD_ENTITY_IDS,
    });
    expect(fiveOnly.ok).toBe(false);
    const build = resolveMealLexicalBuildProfiles({
      loadLexeme: (key) => VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: FRAME_ENTITY_IDS,
    });
    expect(build.ok).toBe(true);
    if (!build.ok) {
      throw new Error(build.reason);
    }
    expect(build.profiles.map((item) => item.stepToken)).toEqual([
      "soup",
      "bowl",
      "spoon",
      "fork",
      "cup",
      "plate",
    ]);
    expect(build.profiles.some((item) => item.entityId === "home-cup")).toBe(true);
    expect(build.profiles.some((item) => item.entityId === "home-plate")).toBe(true);
  });

  it("fails closed on missing meaning or identity mismatch", () => {
    const missingMeaning = resolveMealLexicalStrengthenProfiles({
      loadLexeme: (key) =>
        key === "lex-1300-1" ? { ...VOCAB[key]!, meaningsZh: [] } : VOCAB[key] ?? null,
      displayLabelForEntity: (entityId) => LABELS[entityId] ?? null,
      allowedEntityIds: SIX_WORD_ENTITY_IDS,
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
      allowedEntityIds: SIX_WORD_ENTITY_IDS,
    });
    expect(mismatch.ok).toBe(false);
  });
});
