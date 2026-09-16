import { describe, expect, it } from "vitest";
import { MasteryStage, VocabularySkill, WeaknessType } from "./helpers";
import { makeLexeme, makeModel, makeWeakness, plan } from "./helpers";

describe("Scheduler read-only invariant", () => {
  it("R1–R3: planSession does not mutate input models, weaknesses, or skill states", () => {
    const model = makeModel("quiet", {
      masteryStage: MasteryStage.CONNECTED,
      skillScores: {
        [VocabularySkill.SPELLING_RECALL]: { score: 0.3, confidence: 0.2 },
      },
      weaknesses: [
        makeWeakness({ id: "w1", type: WeaknessType.SPELLING, severity: 0.66 }),
      ],
    });
    const before = structuredClone(model);
    plan({
      lexemes: [makeLexeme("quiet")],
      models: [model],
      requestedNeedCount: 3,
    });
    expect(model).toEqual(before);
    expect(model.weaknesses).toEqual(before.weaknesses);
    expect(model.skills).toEqual(before.skills);
    expect(model.weaknesses[0].resolvedAt).toBeNull();
  });

  it("R4: planning does not create LearningEvidence", () => {
    const model = makeModel("quiet", { masteryStage: MasteryStage.EXPOSED });
    const result = plan({
      lexemes: [makeLexeme("quiet"), makeLexeme("new", 2)],
      models: [model],
    });
    expect(result.needs.length).toBeGreaterThan(0);
    expect(
      JSON.stringify(result).includes("INDEPENDENT_CORRECT") ||
        JSON.stringify(result).includes("learning_evidence"),
    ).toBe(false);
  });
});
