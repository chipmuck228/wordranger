import { describe, expect, it } from "vitest";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { lexemeIdFromCanonicalKey } from "@/lib/canonical-id";
import { BUNDLED_LEXEME_BINDINGS } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import {
  BORROWING_SHARING_SCENE_CLUSTER,
  MEAL_SCENE_CLUSTER,
  SCHOOL_CHALLENGE_SCENE_CLUSTER,
} from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { routeContextualMemory } from "@/contextual-learning/candidate-v0/memory-routing/route-contextual-memory";
import { planningModeFromRoutingDecision } from "@/contextual-learning/candidate-v0/memory-routing/planning-mode";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { SCHOOL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import { BORROW_SENSE } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import type { SceneVocabularyMember } from "@/contextual-learning/candidate-v0/memory-routing/types";

function memberByFixture(
  members: readonly SceneVocabularyMember[],
  fixtureLexemeId: string,
): SceneVocabularyMember {
  const found = members.find(
    (member) => member.candidateFixtureLexemeId === fixtureLexemeId,
  );
  if (!found) {
    throw new Error(`Missing catalog member ${fixtureLexemeId}`);
  }
  return found;
}

describe("three-case scene catalog and routing", () => {
  it("maps Meal fixture words onto structured roles and the Context Lab spoon UUID", () => {
    expect(MEAL_SCENE_CLUSTER.members.map((member) => member.roleId).sort()).toEqual(
      [
        "CONSUME_FOOD_ACTION",
        "DRINK",
        "DRINK_CONTAINER",
        "EATING_TOOL",
        "EATING_TOOL",
        "FOOD",
        "FOOD_CONTAINER",
        "FOOD_SUPPORT",
        "SELECT_ACTION",
      ].sort(),
    );
    const spoon = memberByFixture(MEAL_SCENE_CLUSTER.members, "lex-spoon");
    expect(spoon.target.lexemeId).toBe(BUNDLED_LEXEME_BINDINGS.spoon.lexemeId);
    expect(spoon.target.lexemeId).toBe(lexemeIdFromCanonicalKey("lex-1311-1"));
    expect(spoon.target.lexemeId).toBe(
      lexemeIdFromCanonicalKey(BUNDLED_LEXEME_BINDINGS.spoon.canonicalKey),
    );
    expect(spoon.target.senseId).toBe(MEAL_SENSE.spoon.senseId);
  });

  it("does not derive Meal BUILD from NEW_WORD and does strengthen spoon on due review", () => {
    const target = memberByFixture(MEAL_SCENE_CLUSTER.members, "lex-spoon").target;
    const firstLearn = routeContextualMemory({
      target,
      learningNeed: { lexemeId: target.lexemeId, reason: "NEW_WORD" },
    });
    expect(firstLearn.status).toBe("UNRESOLVED");
    expect(planningModeFromRoutingDecision(firstLearn).ok).toBe(false);

    const strengthen = routeContextualMemory({
      target,
      learningNeed: { lexemeId: target.lexemeId, reason: "REVIEW_DUE" },
    });
    expect(strengthen).toMatchObject({ status: "RESOLVED", intent: "STRENGTHEN" });
    const recall = routeContextualMemory({
      target,
      learningNeed: {
        lexemeId: target.lexemeId,
        reason: "WEAKNESS",
        weaknessFocus: {
          weaknessId: "w-recall",
          type: WeaknessType.ACTIVE_RECALL,
        },
      },
    });
    expect(recall).toMatchObject({
      status: "RESOLVED",
      intent: "STRENGTHEN",
      reason: "FROZEN_WEAKNESS_ACTIVE_RECALL",
    });
  });

  it("keeps School Challenge roles separate and does not revive has_general_ability", () => {
    const ability = memberByFixture(
      SCHOOL_CHALLENGE_SCENE_CLUSTER.members,
      "lex-ability",
    );
    const success = memberByFixture(
      SCHOOL_CHALLENGE_SCENE_CLUSTER.members,
      "lex-success",
    );
    const difficult = memberByFixture(
      SCHOOL_CHALLENGE_SCENE_CLUSTER.members,
      "lex-difficult",
    );
    expect(ability.roleId).toBe("CAPACITY_PROPERTY");
    expect(success.roleId).toBe("OUTCOME");
    expect(difficult.roleId).toBe("REQUIREMENT_JUDGMENT");
    expect(ability.roleDescription).toMatch(/one skill/);
    expect(ability.roleDescription).not.toMatch(/global trait that transfers/i);
    expect(JSON.stringify(SCHOOL_CHALLENGE_SCENE_CLUSTER)).not.toContain(
      "has_general_ability",
    );
    expect(ability.target.lexemeId).toBe(BUNDLED_LEXEME_BINDINGS.ability.lexemeId);
    expect(memberByFixture(SCHOOL_CHALLENGE_SCENE_CLUSTER.members, "lex-possible").target.lexemeId).toBe(
      BUNDLED_LEXEME_BINDINGS.possible.lexemeId,
    );

    const tryTarget = memberByFixture(
      SCHOOL_CHALLENGE_SCENE_CLUSTER.members,
      "lex-try",
    ).target;
    expect(
      routeContextualMemory({
        target: tryTarget,
        learningNeed: { lexemeId: tryTarget.lexemeId, reason: "NEW_WORD" },
      }).status,
    ).toBe("UNRESOLVED");
    expect(
      routeContextualMemory({
        target: tryTarget,
        learningNeed: {
          lexemeId: tryTarget.lexemeId,
          reason: "WEAKNESS",
          weaknessFocus: { weaknessId: "w", type: WeaknessType.CONFUSION },
        },
      }),
    ).toMatchObject({ status: "RESOLVED", intent: "STRENGTHEN" });
  });

  it("keeps borrow/lend perspectives distinct and still strengthens one target", () => {
    const borrow = memberByFixture(
      BORROWING_SHARING_SCENE_CLUSTER.members,
      "lex-borrow",
    );
    const lend = memberByFixture(
      BORROWING_SHARING_SCENE_CLUSTER.members,
      "lex-lend",
    );
    expect(borrow.perspectiveId).toBe("REQUESTER");
    expect(lend.perspectiveId).toBe("OWNER");
    expect(borrow.roleId).toBe("TEMPORARY_RECEIVE");
    expect(lend.roleId).toBe("TEMPORARY_PROVIDE");
    expect(borrow.target.senseId).toBe(BORROW_SENSE.borrow.senseId);
    expect(lend.target.senseId).toBe(BORROW_SENSE.lend.senseId);
    expect(borrow.target.lexemeId).not.toBe(lend.target.lexemeId);

    const strengthen = routeContextualMemory({
      target: borrow.target,
      learningNeed: {
        lexemeId: borrow.target.lexemeId,
        reason: "WEAKNESS",
        weaknessFocus: {
          weaknessId: "w-hint",
          type: WeaknessType.HINT_DEPENDENCY,
        },
      },
    });
    expect(strengthen).toMatchObject({
      status: "RESOLVED",
      intent: "STRENGTHEN",
      reason: "FROZEN_WEAKNESS_HINT_DEPENDENCY",
    });
  });

  it("does not merge senses just because lemmas could collide in another dataset", () => {
    const drink = memberByFixture(MEAL_SCENE_CLUSTER.members, "lex-drink");
    const ability = memberByFixture(
      SCHOOL_CHALLENGE_SCENE_CLUSTER.members,
      "lex-ability",
    );
    expect(drink.target.senseId).toBe(MEAL_SENSE.drink.senseId);
    expect(ability.target.senseId).toBe(SCHOOL_SENSE.ability.senseId);
    expect(drink.target.senseId).not.toBe(ability.target.senseId);
    expect(drink.target.lexemeId).not.toBe(ability.target.lexemeId);
  });
});
