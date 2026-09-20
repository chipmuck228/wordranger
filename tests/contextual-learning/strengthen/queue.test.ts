import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  buildMealStrengthenQueue,
  createMealStrengthenQueueState,
  currentStrengthenQueueItem,
  markStrengthenQueueItemCompleted,
  readMealStrengthenQueue,
  strengthenHandoffLabel,
} from "@/contextual-learning/candidate-v0/strengthen/queue";
import type { ContextualProbeTarget } from "@/contextual-learning/candidate-v0/probe/types";
import { resolveProbeDisposition } from "@/contextual-learning/candidate-v0/probe/resolve-probe-disposition";

const soup = {
  lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.soup),
  senseId: MEAL_SENSE.soup.senseId,
};
const bowl = {
  lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.bowl),
  senseId: MEAL_SENSE.bowl.senseId,
};
const spoon = {
  lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.spoon),
  senseId: MEAL_SENSE.spoon.senseId,
};

function target(entityId: string, sense: typeof soup): ContextualProbeTarget {
  return {
    target: sense,
    sceneClusterId: "meal-scene-v0",
    roleId: "FOOD",
    entityId,
    displayLabel: entityId,
    probeSkills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
  };
}

function strengthenObs(sense: typeof soup, prefix: string) {
  return [
    {
      target: sense,
      skill: "ACTIVE_RECALL" as const,
      taskId: `${prefix}-recall`,
      evidenceId: `${prefix}-ev-r`,
      outcome: EvidenceOutcome.INCORRECT,
    },
    {
      target: sense,
      skill: "MEANING_RECOGNITION" as const,
      taskId: `${prefix}-rec`,
      evidenceId: `${prefix}-ev-m`,
      outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
    },
  ];
}

describe("Meal STRENGTHEN queue", () => {
  it("orders eligible targets by scene order and skips BUILD/READY", () => {
    const targets = [
      target("home-soup", soup),
      target("home-bowl", bowl),
      target("home-spoon", spoon),
    ];
    const observations = [
      ...strengthenObs(soup, "soup"),
      ...strengthenObs(bowl, "bowl"),
      {
        target: spoon,
        skill: "ACTIVE_RECALL" as const,
        taskId: "spoon-recall",
        evidenceId: "spoon-ev",
        outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
      },
    ];
    const results = targets.map((item) =>
      resolveProbeDisposition({
        target: item.target,
        observations: observations.filter(
          (obs) =>
            obs.target.lexemeId === item.target.lexemeId &&
            obs.target.senseId === item.target.senseId,
        ),
      }),
    );
    const queue = buildMealStrengthenQueue({ targets, results });
    expect(queue.map((item) => item.entityId)).toEqual(["home-soup", "home-bowl"]);
    expect(strengthenHandoffLabel(queue.length)).toBe("开始强化 2 个词");
  });

  it("dedupes duplicate targets and fail-closes malformed persisted queues", () => {
    const targets = [target("home-soup", soup), target("home-soup", soup)];
    const observations = strengthenObs(soup, "soup");
    const results = targets.map((item) =>
      resolveProbeDisposition({
        target: item.target,
        observations,
      }),
    );
    const items = buildMealStrengthenQueue({ targets, results });
    expect(items).toHaveLength(1);
    const state = createMealStrengthenQueueState(items)!;
    const marked = markStrengthenQueueItemCompleted(state, soup);
    expect(marked.ok).toBe(true);
    if (marked.ok) {
      expect(currentStrengthenQueueItem(marked.queue)).toBeNull();
      expect(marked.queue.completed).toHaveLength(1);
    }
    expect(readMealStrengthenQueue({ items }).ok).toBe(false);
  });
});
