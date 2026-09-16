import { describe, expect, it } from "vitest";
import {
  selectReviewSkill,
  selectStageProgressSkill,
  weakerSkill,
} from "@/domain/scheduler";
import { MasteryStage, VocabularySkill, makeModel } from "./helpers";

describe("Stage and review skill helpers", () => {
  it("prefers lower score, then lower confidence, then enum order", () => {
    const model = makeModel("x", {
      skillScores: {
        [VocabularySkill.ACTIVE_RECALL]: { score: 0.4, confidence: 0.9 },
        [VocabularySkill.SPELLING_RECALL]: { score: 0.4, confidence: 0.2 },
      },
    });
    expect(
      weakerSkill(
        VocabularySkill.ACTIVE_RECALL,
        VocabularySkill.SPELLING_RECALL,
        model.skills,
      ),
    ).toBe(VocabularySkill.SPELLING_RECALL);

    const tied = makeModel("y", {
      skillScores: {
        [VocabularySkill.ACTIVE_RECALL]: { score: 0.4, confidence: 0.4 },
        [VocabularySkill.SPELLING_RECALL]: { score: 0.4, confidence: 0.4 },
      },
    });
    expect(
      weakerSkill(
        VocabularySkill.ACTIVE_RECALL,
        VocabularySkill.SPELLING_RECALL,
        tied.skills,
      ),
    ).toBe(VocabularySkill.ACTIVE_RECALL);
  });

  it("selectStageProgressSkill follows V1 stage guidance", () => {
    expect(
      selectStageProgressSkill(makeModel("a", { masteryStage: MasteryStage.UNSEEN })),
    ).toBe(VocabularySkill.MEANING_RECOGNITION);
    expect(
      selectStageProgressSkill(makeModel("a", { masteryStage: MasteryStage.EXPOSED })),
    ).toBe(VocabularySkill.MEANING_RECOGNITION);
    expect(
      selectStageProgressSkill(makeModel("a", { masteryStage: MasteryStage.RECOGNIZED })),
    ).toBe(VocabularySkill.SEMANTIC_CONNECTION);
    expect(
      selectStageProgressSkill(
        makeModel("a", {
          masteryStage: MasteryStage.CONNECTED,
          skillScores: {
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.2, confidence: 0.2 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.9, confidence: 0.9 },
          },
        }),
      ),
    ).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(
      selectStageProgressSkill(makeModel("a", { masteryStage: MasteryStage.USABLE })),
    ).toBe(VocabularySkill.CONTEXT_USE);
    expect(
      selectStageProgressSkill(makeModel("a", { masteryStage: MasteryStage.MASTERED })),
    ).toBeNull();
  });

  it("selectReviewSkill uses available production skills and MASTERED review", () => {
    expect(
      selectReviewSkill(makeModel("a", { masteryStage: MasteryStage.RECOGNIZED })),
    ).toBe(VocabularySkill.MEANING_RECOGNITION);
    expect(
      selectReviewSkill(
        makeModel("a", {
          masteryStage: MasteryStage.CONNECTED,
          skillScores: {
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.7, confidence: 0.5 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.1, confidence: 0.5 },
          },
        }),
      ),
    ).toBe(VocabularySkill.SPELLING_RECALL);
    expect(
      selectReviewSkill(
        makeModel("a", {
          masteryStage: MasteryStage.RECALLED,
          skillScores: {
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.2, confidence: 0.5 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.8, confidence: 0.5 },
          },
        }),
      ),
    ).toBe(VocabularySkill.ACTIVE_RECALL);
    const mastered = selectReviewSkill(
      makeModel("a", {
        masteryStage: MasteryStage.MASTERED,
        skillScores: {
          [VocabularySkill.MEANING_RECOGNITION]: {
            score: 0.9,
            confidence: 0.8,
            attempts: 10,
          },
          [VocabularySkill.SPELLING_RECALL]: {
            score: 0.4,
            confidence: 0.4,
            attempts: 6,
          },
        },
      }),
    );
    expect(mastered).toBe(VocabularySkill.SPELLING_RECALL);
  });
});
