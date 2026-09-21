import { describe, expect, it } from "vitest";
import { MEAL_SCENE_CONTENT_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { snapshotSceneContentFromPack } from "@/contextual-learning/candidate-v0/content/snapshot-from-pack";
import {
  homeBreakfastFrame,
  restaurantMealFrame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { projectResolvedMealContentOntoFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/project-resolved-onto-frame";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { findResolvedLexeme } from "@/contextual-learning/candidate-v0/content/project-from-resolved";

describe("Meal resolved-content projection", () => {
  it("rematches destination facts by predicate and ordered arguments", () => {
    const snapshot = snapshotSceneContentFromPack(
      MEAL_SCENE_CONTENT_PACK,
      homeBreakfastFrame.id,
    );
    expect(snapshot).not.toBeNull();
    const projected = projectResolvedMealContentOntoFrame(snapshot!, restaurantMealFrame);
    expect(projected).not.toBeNull();
    if (!projected) {
      return;
    }
    expect(projected.frame.frameId).toBe(restaurantMealFrame.id);
    expect(projected.frame.factIds).toEqual([
      "rest-fact-contains-bowl-soup",
      "rest-fact-suitable-for-spoon-soup",
    ]);
    const soup = findResolvedLexeme(projected, MEAL_SENSE.soup);
    expect(soup?.entityId).toBe("rest-soup");
    expect(soup?.groundingFacts).toEqual([
      {
        factId: "rest-fact-contains-bowl-soup",
        predicate: "contains",
        args: [
          { kind: "ENTITY", entityId: "rest-bowl" },
          { kind: "ENTITY", entityId: "rest-soup" },
        ],
        caption: "碗里装着汤",
      },
    ]);
    expect(soup?.build.connectFactId).toBe("rest-fact-contains-bowl-soup");
    expect(JSON.stringify(projected)).not.toContain("home-fact-");
    expect(JSON.stringify(projected)).not.toContain("home-soup");
  });

  it("fails closed when the destination frame lacks the same directed fact", () => {
    const snapshot = snapshotSceneContentFromPack(
      MEAL_SCENE_CONTENT_PACK,
      homeBreakfastFrame.id,
    );
    expect(snapshot).not.toBeNull();
    const missingContains = {
      ...restaurantMealFrame,
      initialFacts: restaurantMealFrame.initialFacts.filter(
        (fact) => fact.id !== "rest-fact-contains-bowl-soup",
      ),
    };
    expect(projectResolvedMealContentOntoFrame(snapshot!, missingContains)).toBeNull();

    const reversedContains = {
      ...restaurantMealFrame,
      initialFacts: restaurantMealFrame.initialFacts.map((fact) =>
        fact.id === "rest-fact-contains-bowl-soup"
          ? {
              ...fact,
              arguments: [...fact.arguments].reverse(),
            }
          : fact,
      ),
    };
    expect(projectResolvedMealContentOntoFrame(snapshot!, reversedContains)).toBeNull();
  });
});
