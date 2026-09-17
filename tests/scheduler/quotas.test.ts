import { describe, expect, it } from "vitest";
import { MasteryStage, VocabularySkill } from "./helpers";
import { makeLexeme, makeModel, plan, policyWith } from "./helpers";

describe("Scheduler quotas", () => {
  it("S1: many unseen + many review candidates → maxNewWords respected", () => {
    const reviewModels = Array.from({ length: 20 }, (_, index) =>
      makeModel(`rev-${index}`, {
        masteryStage: MasteryStage.CONNECTED,
        nextReviewAt: "2026-09-01T00:00:00.000Z",
        skillScores: {
          [VocabularySkill.ACTIVE_RECALL]: { score: 0.4, confidence: 0.3 },
          [VocabularySkill.SPELLING_RECALL]: { score: 0.6, confidence: 0.4 },
        },
      }),
    );
    const lexemes = [
      ...reviewModels.map((model, index) => makeLexeme(model.lexemeId, index + 1)),
      ...Array.from({ length: 1000 }, (_, index) =>
        makeLexeme(`new-${index}`, index + 100),
      ),
    ];
    const result = plan({
      lexemes,
      models: reviewModels,
      requestedNeedCount: 10,
      policy: policyWith({
        session: { defaultNeedCount: 10, maxNewWords: 3, minReviewNeeds: 4 },
      }),
    });
    const newWords = result.needs.filter((need) => need.reason === "NEW_WORD");
    expect(newWords.length).toBeLessThanOrEqual(3);
    expect(result.needs).toHaveLength(10);
  });

  it("S2: enough review candidates → minReviewNeeds respected", () => {
    const models = Array.from({ length: 8 }, (_, index) =>
      makeModel(`rev-${index}`, {
        masteryStage: MasteryStage.CONNECTED,
        nextReviewAt: "2026-09-01T00:00:00.000Z",
      }),
    );
    const result = plan({
      lexemes: models.map((model, index) => makeLexeme(model.lexemeId, index + 1)),
      models,
      requestedNeedCount: 10,
      policy: policyWith({
        session: { defaultNeedCount: 10, maxNewWords: 3, minReviewNeeds: 4 },
      }),
    });
    const reviews = result.needs.filter((need) =>
      ["WEAKNESS", "FADING", "REVIEW_DUE"].includes(need.reason),
    );
    expect(reviews.length).toBeGreaterThanOrEqual(4);
  });

  it("S3: insufficient review candidates → remaining slots may be NEW_WORD", () => {
    const models = [
      makeModel("only-due", {
        masteryStage: MasteryStage.CONNECTED,
        nextReviewAt: "2026-09-01T00:00:00.000Z",
      }),
    ];
    const lexemes = [
      makeLexeme("only-due", 1),
      ...Array.from({ length: 20 }, (_, index) => makeLexeme(`n-${index}`, index + 2)),
    ];
    const result = plan({
      lexemes,
      models,
      requestedNeedCount: 10,
      policy: policyWith({
        session: { defaultNeedCount: 10, maxNewWords: 3, minReviewNeeds: 4 },
      }),
    });
    const newWords = result.needs.filter((need) => need.reason === "NEW_WORD");
    expect(newWords.length).toBeGreaterThan(3);
    expect(result.needs).toHaveLength(10);
  });

  it("S4: requestedNeedCount is respected", () => {
    const lexemes = Array.from({ length: 30 }, (_, index) =>
      makeLexeme(`n-${index}`, index + 1),
    );
    const result = plan({
      lexemes,
      models: [],
      requestedNeedCount: 5,
    });
    expect(result.needs).toHaveLength(5);
    expect(result.requestedNeedCount).toBe(5);
  });

  it("S5: no candidates → valid empty plan", () => {
    const result = plan({
      lexemes: [],
      models: [],
      requestedNeedCount: 10,
    });
    expect(result.needs).toEqual([]);
    expect(result.trace.selectedCandidates).toEqual([]);
    expect(result.schedulerPolicyVersion).toBe("v2");
  });
});
