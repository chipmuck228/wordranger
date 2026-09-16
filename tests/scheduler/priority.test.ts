import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULER_POLICY, scoreCandidate } from "@/domain/scheduler";
import { VocabularySkill, WeaknessType } from "./helpers";
import {
  NOW,
  MasteryStage,
  makeLexeme,
  makeModel,
  makeWeakness,
  plan,
} from "./helpers";
import type { LearningNeedCandidate } from "@/domain/scheduler";

function weaknessCandidate(
  severity: number,
  id = "c1",
): LearningNeedCandidate {
  return {
    id,
    lexemeId: "quiet",
    targetSkill: VocabularySkill.SPELLING_RECALL,
    reason: "WEAKNESS",
    basePriority: DEFAULT_SCHEDULER_POLICY.reasonWeights.WEAKNESS,
    weaknessFocus: {
      weaknessId: "w1",
      type: WeaknessType.SPELLING,
    },
    preferredPromptModes: [],
    source: { ruleId: "WEAKNESS_SPELLING", explanation: "test" },
    metadata: { severity },
  };
}

describe("Priority scoring", () => {
  const model = makeModel("quiet", {
    masteryStage: MasteryStage.CONNECTED,
    nextReviewAt: "2026-09-10T00:00:00.000Z",
    skillScores: {
      [VocabularySkill.SPELLING_RECALL]: { score: 0.4, confidence: 0.5 },
    },
  });

  it("P1: higher weakness severity → higher score", () => {
    const low = scoreCandidate(
      weaknessCandidate(0.2),
      model,
      [],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    const high = scoreCandidate(
      weaknessCandidate(0.9),
      model,
      [],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    expect(high.weaknessBoost).toBeGreaterThan(low.weaknessBoost);
    expect(high.finalRawScore).toBeGreaterThan(low.finalRawScore);
  });

  it("P2: more overdue → higher overdue boost", () => {
    const due = makeModel("quiet", {
      masteryStage: MasteryStage.CONNECTED,
      nextReviewAt: "2026-09-15T12:00:00.000Z",
    });
    const later = makeModel("quiet", {
      masteryStage: MasteryStage.CONNECTED,
      nextReviewAt: "2026-09-01T12:00:00.000Z",
    });
    const candidate: LearningNeedCandidate = {
      ...weaknessCandidate(0.5),
      reason: "REVIEW_DUE",
      weaknessFocus: undefined,
      metadata: undefined,
    };
    const slight = scoreCandidate(candidate, due, [], NOW, DEFAULT_SCHEDULER_POLICY);
    const late = scoreCandidate(candidate, later, [], NOW, DEFAULT_SCHEDULER_POLICY);
    expect(late.overdueBoost).toBeGreaterThan(slight.overdueBoost);
  });

  it("P3: overdue boost is capped", () => {
    const twoWeeks = makeModel("quiet", {
      masteryStage: MasteryStage.CONNECTED,
      nextReviewAt: "2026-09-02T12:00:00.000Z",
    });
    const ancient = makeModel("quiet", {
      masteryStage: MasteryStage.CONNECTED,
      nextReviewAt: "2020-01-01T00:00:00.000Z",
    });
    const candidate: LearningNeedCandidate = {
      ...weaknessCandidate(0.5),
      reason: "REVIEW_DUE",
      weaknessFocus: undefined,
    };
    const capped = scoreCandidate(
      candidate,
      twoWeeks,
      [],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    const older = scoreCandidate(
      candidate,
      ancient,
      [],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    expect(capped.overdueBoost).toBe(DEFAULT_SCHEDULER_POLICY.overdue.maxBoost);
    expect(older.overdueBoost).toBe(DEFAULT_SCHEDULER_POLICY.overdue.maxBoost);
  });

  it("P4: FADING increases priority", () => {
    const fading: LearningNeedCandidate = {
      ...weaknessCandidate(0),
      id: "fade",
      reason: "FADING",
      weaknessFocus: undefined,
      metadata: undefined,
    };
    const review: LearningNeedCandidate = {
      ...fading,
      id: "rev",
      reason: "REVIEW_DUE",
    };
    const fadeScore = scoreCandidate(fading, model, [], NOW, DEFAULT_SCHEDULER_POLICY);
    const reviewScore = scoreCandidate(review, model, [], NOW, DEFAULT_SCHEDULER_POLICY);
    expect(fadeScore.fadingBoost).toBe(DEFAULT_SCHEDULER_POLICY.fading.boost);
    expect(fadeScore.fadingBoost).toBeGreaterThan(reviewScore.fadingBoost);
  });

  it("P5: recent same lexeme lowers priority", () => {
    const without = scoreCandidate(
      weaknessCandidate(0.5),
      model,
      [],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    const withRecent = scoreCandidate(
      weaknessCandidate(0.5),
      model,
      [
        {
          lexemeId: "quiet",
          skill: VocabularySkill.SPELLING_RECALL,
          taskType: "SPELLING_RECALL_TYPING",
          occurredAt: NOW,
        },
      ],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    expect(withRecent.recencyPenalty).toBeGreaterThan(without.recencyPenalty);
    expect(withRecent.finalRawScore).toBeLessThan(without.finalRawScore);
  });

  it("P6: low skill score increases priority", () => {
    const weakSkill = makeModel("quiet", {
      masteryStage: MasteryStage.CONNECTED,
      skillScores: {
        [VocabularySkill.SPELLING_RECALL]: { score: 0.1, confidence: 0.5 },
      },
    });
    const strongSkill = makeModel("quiet", {
      masteryStage: MasteryStage.CONNECTED,
      skillScores: {
        [VocabularySkill.SPELLING_RECALL]: { score: 0.9, confidence: 0.5 },
      },
    });
    const low = scoreCandidate(
      weaknessCandidate(0.5),
      weakSkill,
      [],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    const high = scoreCandidate(
      weaknessCandidate(0.5),
      strongSkill,
      [],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    expect(low.skillGapBoost).toBeGreaterThan(high.skillGapBoost);
  });

  it("P7: same input yields the same breakdown", () => {
    const first = scoreCandidate(
      weaknessCandidate(0.55),
      model,
      [],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    const second = scoreCandidate(
      weaknessCandidate(0.55),
      model,
      [],
      NOW,
      DEFAULT_SCHEDULER_POLICY,
    );
    expect(second).toEqual(first);
    const result = plan({
      lexemes: [makeLexeme("quiet")],
      models: [
        makeModel("quiet", {
          masteryStage: MasteryStage.CONNECTED,
          weaknesses: [
            makeWeakness({ id: "w1", type: WeaknessType.SPELLING, severity: 0.55 }),
          ],
        }),
      ],
    });
    expect(result.schedulerPolicyVersion).toBe("v1");
  });
});
