import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  buildHandoffLabel,
  buildMealBuildQueue,
  createMealBuildQueueState,
  currentBuildQueueItem,
  markBuildQueueItemCompleted,
} from "@/contextual-learning/candidate-v0/build/queue";
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

function buildObs(sense: typeof soup, prefix: string) {
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
      outcome: EvidenceOutcome.INCORRECT,
    },
  ];
}

describe("Meal BUILD queue", () => {
  it("orders eligible BUILD targets by scene order and skips STRENGTHEN/READY", () => {
    const targets = [
      target("home-soup", soup),
      target("home-bowl", bowl),
      target("home-spoon", spoon),
    ];
    const observations = [
      ...buildObs(soup, "soup"),
      {
        target: bowl,
        skill: "ACTIVE_RECALL" as const,
        taskId: "bowl-recall",
        evidenceId: "bowl-ev",
        outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
      },
      ...buildObs(spoon, "spoon"),
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
    const built = buildMealBuildQueue({ targets, results });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.items.map((item) => item.entityId)).toEqual([
        "home-soup",
        "home-spoon",
      ]);
      expect(buildHandoffLabel(built.items.length)).toBe("开始建立 2 个词");
    }
  });

  it("fails closed when BUILD disposition does not match observations", () => {
    const targets = [target("home-soup", soup)];
    const built = buildMealBuildQueue({
      targets,
      results: [
        {
          target: soup,
          disposition: "BUILD",
          observations: [
            {
              target: soup,
              skill: "ACTIVE_RECALL",
              taskId: "soup-recall",
              evidenceId: "ev",
              outcome: EvidenceOutcome.INCORRECT,
            },
            {
              target: soup,
              skill: "MEANING_RECOGNITION",
              taskId: "soup-rec",
              evidenceId: "ev2",
              outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
            },
          ],
          reason: "tampered",
          provenance: {
            source: "FROZEN_LEARNING_EVIDENCE",
            taskIds: ["soup-recall", "soup-rec"],
            evidenceIds: ["ev", "ev2"],
            ruleId: "tampered",
          },
        },
      ],
    });
    expect(built.ok).toBe(false);
  });

  it("dedupes duplicate targets when building", () => {
    const targets = [target("home-soup", soup), target("home-soup", soup)];
    const observations = buildObs(soup, "soup");
    const results = targets.map((item) =>
      resolveProbeDisposition({
        target: item.target,
        observations,
      }),
    );
    const built = buildMealBuildQueue({ targets, results });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.items).toHaveLength(1);
      const state = createMealBuildQueueState(built.items)!;
      const marked = markBuildQueueItemCompleted(state, soup);
      expect(marked.ok).toBe(true);
      if (marked.ok) {
        expect(currentBuildQueueItem(marked.queue)).toBeNull();
      }
    }
  });
});
