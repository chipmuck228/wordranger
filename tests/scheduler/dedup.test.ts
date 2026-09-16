import { describe, expect, it } from "vitest";
import { MasteryStage, RetentionState, VocabularySkill, WeaknessType } from "./helpers";
import { makeLexeme, makeModel, makeWeakness, plan } from "./helpers";

describe("Candidate deduplication", () => {
  it("D1: same lexeme + skill from WEAKNESS/FADING/REVIEW_DUE become one LearningNeed", () => {
    const result = plan({
      lexemes: [makeLexeme("quiet")],
      models: [
        makeModel("quiet", {
          masteryStage: MasteryStage.CONNECTED,
          retentionState: RetentionState.FADING,
          nextReviewAt: "2026-09-01T00:00:00.000Z",
          skillScores: {
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.8, confidence: 0.6 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.2, confidence: 0.3 },
          },
          weaknesses: [
            makeWeakness({ id: "w-spell", type: WeaknessType.SPELLING, severity: 0.8 }),
          ],
        }),
      ],
      requestedNeedCount: 5,
    });
    const spelling = result.needs.filter(
      (need) =>
        need.lexemeId === "quiet" &&
        need.targetSkill === VocabularySkill.SPELLING_RECALL,
    );
    expect(spelling).toHaveLength(1);
  });

  it("D2: primary reason WEAKNESS with supporting FADING and REVIEW_DUE", () => {
    const result = plan({
      lexemes: [makeLexeme("quiet")],
      models: [
        makeModel("quiet", {
          masteryStage: MasteryStage.CONNECTED,
          retentionState: RetentionState.FADING,
          nextReviewAt: "2026-09-01T00:00:00.000Z",
          skillScores: {
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.8, confidence: 0.6 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.2, confidence: 0.3 },
          },
          weaknesses: [
            makeWeakness({ id: "w-spell", type: WeaknessType.SPELLING, severity: 0.8 }),
          ],
        }),
      ],
      requestedNeedCount: 5,
    });
    const spelling = result.needs.find(
      (need) => need.targetSkill === VocabularySkill.SPELLING_RECALL,
    );
    expect(spelling?.reason).toBe("WEAKNESS");
    expect(spelling?.supportingReasons).toEqual(
      expect.arrayContaining(["FADING", "REVIEW_DUE"]),
    );
  });

  it("D3: different skills on the same lexeme remain separate needs", () => {
    const result = plan({
      lexemes: [makeLexeme("quiet")],
      models: [
        makeModel("quiet", {
          masteryStage: MasteryStage.RECOGNIZED,
          nextReviewAt: "2026-09-01T00:00:00.000Z",
          weaknesses: [
            makeWeakness({ id: "w-spell", type: WeaknessType.SPELLING, severity: 0.7 }),
          ],
        }),
      ],
      requestedNeedCount: 5,
    });
    const skills = result.needs
      .filter((need) => need.lexemeId === "quiet")
      .map((need) => need.targetSkill);
    expect(new Set(skills).size).toBeGreaterThan(1);
  });

  it("D4: multiple weaknesses same lexeme+skill → highest severity weaknessFocus", () => {
    const result = plan({
      lexemes: [makeLexeme("quiet")],
      models: [
        makeModel("quiet", {
          masteryStage: MasteryStage.CONNECTED,
          weaknesses: [
            makeWeakness({
              id: "w-low",
              type: WeaknessType.SPELLING,
              severity: 0.2,
            }),
            makeWeakness({
              id: "w-high",
              type: WeaknessType.SPELLING,
              severity: 0.9,
            }),
          ],
        }),
      ],
      requestedNeedCount: 5,
    });
    const spelling = result.needs.find(
      (need) => need.targetSkill === VocabularySkill.SPELLING_RECALL,
    );
    expect(spelling?.weaknessFocus?.weaknessId).toBe("w-high");
  });
});
