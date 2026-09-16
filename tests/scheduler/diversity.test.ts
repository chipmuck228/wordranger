import { describe, expect, it } from "vitest";
import { MasteryStage, VocabularySkill, WeaknessType } from "./helpers";
import { makeLexeme, makeModel, makeWeakness, plan, policyWith } from "./helpers";

function spellingModels(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) =>
    makeModel(`${prefix}-${index}`, {
      masteryStage: MasteryStage.CONNECTED,
      weaknesses: [
        makeWeakness({
          id: `w-${prefix}-${index}`,
          type: WeaknessType.SPELLING,
          severity: 0.8,
        }),
      ],
    }),
  );
}

function meaningModels(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) =>
    makeModel(`${prefix}-${index}`, {
      masteryStage: MasteryStage.RECOGNIZED,
      weaknesses: [
        makeWeakness({
          id: `w-${prefix}-${index}`,
          type: WeaknessType.MEANING,
          severity: 0.75,
        }),
      ],
    }),
  );
}

describe("Scheduler diversity", () => {
  it("V1: maxSameSkillInRow respected when alternatives exist", () => {
    const spelling = spellingModels(6, "sp");
    const meaning = meaningModels(6, "mn");
    const models = [...spelling, ...meaning];
    const result = plan({
      lexemes: models.map((model, index) => makeLexeme(model.lexemeId, index + 1)),
      models,
      requestedNeedCount: 8,
      policy: policyWith({
        diversity: { maxSameSkillInRow: 2, maxSameReasonInRow: 8 },
        session: { defaultNeedCount: 8, maxNewWords: 0, minReviewNeeds: 0 },
      }),
    });
    const skills = result.needs.map((need) => need.targetSkill);
    for (let index = 2; index < skills.length; index += 1) {
      if (
        skills[index] === skills[index - 1] &&
        skills[index - 1] === skills[index - 2]
      ) {
        throw new Error(`three ${skills[index]} in a row`);
      }
    }
    expect(skills).toContain(VocabularySkill.SPELLING_RECALL);
    expect(skills).toContain(VocabularySkill.MEANING_RECOGNITION);
  });

  it("V2: maxSameReasonInRow respected when alternatives exist", () => {
    const weakness = spellingModels(6, "wk");
    const progress = Array.from({ length: 6 }, (_, index) =>
      makeModel(`pg-${index}`, {
        masteryStage: MasteryStage.EXPOSED,
        nextReviewAt: null,
      }),
    );
    const models = [...weakness, ...progress];
    const result = plan({
      lexemes: models.map((model, index) => makeLexeme(model.lexemeId, index + 1)),
      models,
      requestedNeedCount: 8,
      policy: policyWith({
        diversity: { maxSameSkillInRow: 8, maxSameReasonInRow: 2 },
        session: { defaultNeedCount: 8, maxNewWords: 0, minReviewNeeds: 0 },
      }),
    });
    const reasons = result.needs.map((need) => need.reason);
    for (let index = 2; index < reasons.length; index += 1) {
      if (
        reasons[index] === reasons[index - 1] &&
        reasons[index - 1] === reasons[index - 2]
      ) {
        throw new Error(`three ${reasons[index]} in a row`);
      }
    }
  });

  it("V3: constraints relax when otherwise the plan cannot be filled", () => {
    const models = Array.from({ length: 6 }, (_, index) =>
      makeModel(`only-${index}`, {
        masteryStage: MasteryStage.MASTERED,
        nextReviewAt: null,
        weaknesses: [
          makeWeakness({
            id: `w-only-${index}`,
            type: WeaknessType.SPELLING,
            severity: 0.8,
          }),
        ],
      }),
    );
    const result = plan({
      lexemes: models.map((model, index) => makeLexeme(model.lexemeId, index + 1)),
      models,
      requestedNeedCount: 5,
      policy: policyWith({
        diversity: { maxSameSkillInRow: 1, maxSameReasonInRow: 1 },
        session: { defaultNeedCount: 5, maxNewWords: 0, minReviewNeeds: 0 },
      }),
    });
    expect(result.needs).toHaveLength(5);
    expect(
      result.trace.diversityDecisions.some((item) => item.kind === "RELAXED"),
    ).toBe(true);
  });

  it("V4: deferred candidate may appear later", () => {
    const spelling = spellingModels(3, "sp");
    const meaning = meaningModels(3, "mn");
    const models = [...spelling, ...meaning];
    const result = plan({
      lexemes: models.map((model, index) => makeLexeme(model.lexemeId, index + 1)),
      models,
      requestedNeedCount: 4,
      policy: policyWith({
        diversity: { maxSameSkillInRow: 1, maxSameReasonInRow: 8 },
        session: { defaultNeedCount: 4, maxNewWords: 0, minReviewNeeds: 0 },
      }),
    });
    const skills = result.needs.map((need) => need.targetSkill);
    const first = skills[0];
    const laterSame = skills.findIndex((skill, index) => index > 0 && skill === first);
    expect(laterSame).toBeGreaterThan(1);
    expect(result.trace.deferredCandidates.length).toBeGreaterThan(0);
  });
});
