import { describe, expect, it } from "vitest";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { mealLexicalQueueCatalog } from "@/contextual-learning/candidate-v0/build/meal-lexical-build-profiles";
import { MEAL_BUILD_ORCHESTRATION_VERSION } from "@/contextual-learning/candidate-v0/build/types";
import {
  createContextualTargetQueueState,
  markQueueItemCompleted,
  readContextualTargetQueue,
} from "@/contextual-learning/candidate-v0/queue/target-queue";
import { readMealBuildQueue } from "@/contextual-learning/candidate-v0/build/queue";
import { readMealStrengthenQueue } from "@/contextual-learning/candidate-v0/strengthen/queue";
import { MEAL_STRENGTHEN_ORCHESTRATION_VERSION } from "@/contextual-learning/candidate-v0/strengthen/types";

const soup = {
  lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.soup),
  senseId: MEAL_SENSE.soup.senseId,
};
const bowl = {
  lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.bowl),
  senseId: MEAL_SENSE.bowl.senseId,
};

function catalog() {
  const listed = mealLexicalQueueCatalog();
  if (!listed.ok) {
    throw new Error(listed.reason);
  }
  return listed.catalog;
}

function validItems() {
  return [
    {
      target: soup,
      entityId: "home-soup",
      sourceProbeTaskIds: ["soup-recall", "soup-rec"],
    },
    {
      target: bowl,
      entityId: "home-bowl",
      sourceProbeTaskIds: ["bowl-recall", "bowl-rec"],
    },
  ];
}

describe("contextual target queue persistence", () => {
  it("round-trips a valid scene-order queue", () => {
    const state = createContextualTargetQueueState(
      MEAL_BUILD_ORCHESTRATION_VERSION,
      validItems(),
    )!;
    const read = readContextualTargetQueue({
      value: state,
      expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
      catalog: catalog(),
      gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
    });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.queue.items.map((item) => item.entityId)).toEqual([
        "home-soup",
        "home-bowl",
      ]);
    }
  });

  it("rejects unknown version, malformed completed, and duplicate task IDs", () => {
    const state = createContextualTargetQueueState(
      MEAL_BUILD_ORCHESTRATION_VERSION,
      validItems(),
    )!;
    expect(
      readContextualTargetQueue({
        value: { ...state, version: "build-queue-v0" },
        expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
        catalog: catalog(),
        gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
      }).ok,
    ).toBe(false);
    expect(
      readContextualTargetQueue({
        value: { ...state, completed: [{ lexemeId: soup.lexemeId, senseId: "" }] },
        expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
        catalog: catalog(),
        gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
      }).ok,
    ).toBe(false);
    expect(
      readContextualTargetQueue({
        value: {
          ...state,
          items: [
            {
              target: soup,
              entityId: "home-soup",
              sourceProbeTaskIds: ["shared", "shared"],
            },
          ],
        },
        expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
        catalog: catalog(),
        gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
      }).ok,
    ).toBe(false);
  });

  it("rejects invalid entity bindings, order, currentPlanId, and completed drift", () => {
    const state = createContextualTargetQueueState(
      MEAL_BUILD_ORCHESTRATION_VERSION,
      validItems(),
    )!;
    expect(
      readContextualTargetQueue({
        value: {
          ...state,
          items: [{ target: soup, entityId: "home-fork", sourceProbeTaskIds: ["a", "b"] }],
        },
        expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
        catalog: catalog(),
        gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
      }).ok,
    ).toBe(false);
    expect(
      readContextualTargetQueue({
        value: {
          ...state,
          items: [state.items[1], state.items[0]],
        },
        expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
        catalog: catalog(),
        gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
      }).ok,
    ).toBe(false);
    expect(
      readContextualTargetQueue({
        value: { ...state, currentPlanId: "" },
        expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
        catalog: catalog(),
        gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
      }).ok,
    ).toBe(false);
    const marked = markQueueItemCompleted(state, soup);
    expect(marked.ok).toBe(true);
    if (marked.ok) {
      expect(
        readContextualTargetQueue({
          value: {
            ...marked.queue,
            completed: [bowl],
            currentIndex: 1,
          },
          expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
          catalog: catalog(),
          gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
        }).ok,
      ).toBe(false);
      expect(
        readContextualTargetQueue({
          value: { ...marked.queue, currentIndex: 2 },
          expectedVersion: MEAL_BUILD_ORCHESTRATION_VERSION,
          catalog: catalog(),
          gapReason: "BUILD_QUEUE_PERSISTENCE_GAP",
        }).ok,
      ).toBe(false);
    }
  });

  it("uses the shared validator for BUILD and STRENGTHEN readers", () => {
    expect(readMealBuildQueue({ version: "nope" }).ok).toBe(false);
    expect(readMealStrengthenQueue({ version: "nope" }).ok).toBe(false);
    const build = createContextualTargetQueueState(
      MEAL_BUILD_ORCHESTRATION_VERSION,
      validItems(),
    );
    const strengthen = createContextualTargetQueueState(
      MEAL_STRENGTHEN_ORCHESTRATION_VERSION,
      validItems(),
    );
    expect(readMealBuildQueue(build).ok).toBe(true);
    expect(readMealStrengthenQueue(strengthen).ok).toBe(true);
    expect(readMealBuildQueue(strengthen).ok).toBe(false);
  });
});
