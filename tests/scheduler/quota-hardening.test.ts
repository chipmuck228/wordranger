import { describe, expect, it } from "vitest";
import {
  isNewIntroductionNeed,
  isReviewNeed,
  learningNeedHasReason,
} from "@/domain/scheduler";
import type { LearningNeed } from "@/domain/learning/learning-need";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { PromptMode } from "@/domain/learning/evidence.types";
import { MasteryStage } from "./helpers";
import { makeLexeme, makeModel, plan, policyWith } from "./helpers";

function need(
  overrides: Partial<LearningNeed> & Pick<LearningNeed, "reason">,
): LearningNeed {
  return {
    id: "n1",
    lexemeId: "x",
    targetSkill: VocabularySkill.MEANING_RECOGNITION,
    priority: 0.5,
    preferredPromptModes: [PromptMode.WORD_TO_MEANING],
    avoidRecentTaskTypes: [],
    ...overrides,
  };
}

describe("Quota reason classification", () => {
  it("QH2 helper: USER_MARKED + REVIEW_DUE counts as review", () => {
    const item = need({
      reason: "USER_MARKED",
      supportingReasons: ["REVIEW_DUE"],
    });
    expect(item.reason).toBe("USER_MARKED");
    expect(isReviewNeed(item)).toBe(true);
    expect(isNewIntroductionNeed(item)).toBe(false);
  });

  it("QH3 helper: WEAKNESS + NEW_WORD counts as review and new-introduction", () => {
    const item = need({
      reason: "WEAKNESS",
      supportingReasons: ["NEW_WORD"],
    });
    expect(isReviewNeed(item)).toBe(true);
    expect(isNewIntroductionNeed(item)).toBe(true);
    expect(learningNeedHasReason(item, "WEAKNESS")).toBe(true);
    expect(learningNeedHasReason(item, "NEW_WORD")).toBe(true);
  });

  it("QH1: USER_MARKED-primary unseen words still respect maxNewWords", () => {
    const reviews = Array.from({ length: 8 }, (_, index) =>
      makeModel(`rev-${index}`, {
        masteryStage: MasteryStage.CONNECTED,
        nextReviewAt: "2026-09-01T00:00:00.000Z",
      }),
    );
    const unseen = Array.from({ length: 10 }, (_, index) =>
      makeLexeme(`new-${index}`, index + 20),
    );
    const result = plan({
      lexemes: [
        ...reviews.map((model, index) => makeLexeme(model.lexemeId, index + 1)),
        ...unseen,
      ],
      models: reviews,
      userMarkedLexemes: unseen.map((lexeme) => ({
        lexemeId: lexeme.id,
        markedAt: "2026-09-16T12:00:00.000Z",
      })),
      requestedNeedCount: 10,
      policy: policyWith({
        session: { defaultNeedCount: 10, maxNewWords: 3, minReviewNeeds: 4 },
      }),
    });
    const newIntro = result.needs.filter((item) => isNewIntroductionNeed(item));
    expect(newIntro.length).toBeLessThanOrEqual(3);
    expect(
      newIntro.every(
        (item) =>
          item.reason === "USER_MARKED" || item.reason === "NEW_WORD",
      ),
    ).toBe(true);
    expect(result.needs.filter((item) => isReviewNeed(item)).length).toBeGreaterThanOrEqual(
      4,
    );
  });

  it("QH2: USER_MARKED-primary due review counts toward minReviewNeeds", () => {
    const dueMarked = Array.from({ length: 4 }, (_, index) =>
      makeModel(`due-${index}`, {
        masteryStage: MasteryStage.CONNECTED,
        nextReviewAt: "2026-09-01T00:00:00.000Z",
      }),
    );
    const unseen = Array.from({ length: 20 }, (_, index) =>
      makeLexeme(`n-${index}`, index + 10),
    );
    const result = plan({
      lexemes: [
        ...dueMarked.map((model, index) => makeLexeme(model.lexemeId, index + 1)),
        ...unseen,
      ],
      models: dueMarked,
      userMarkedLexemes: dueMarked.map((model) => ({
        lexemeId: model.lexemeId,
        markedAt: "2026-09-16T12:00:00.000Z",
        preferredSkill: VocabularySkill.ACTIVE_RECALL,
      })),
      requestedNeedCount: 10,
      policy: policyWith({
        session: { defaultNeedCount: 10, maxNewWords: 3, minReviewNeeds: 4 },
      }),
    });
    const markedReviews = result.needs.filter(
      (item) =>
        item.reason === "USER_MARKED" &&
        item.supportingReasons?.includes("REVIEW_DUE"),
    );
    expect(markedReviews.length).toBeGreaterThan(0);
    expect(result.needs.filter((item) => isReviewNeed(item)).length).toBeGreaterThanOrEqual(
      4,
    );
  });
});
