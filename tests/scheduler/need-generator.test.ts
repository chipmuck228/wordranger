import { describe, expect, it } from "vitest";
import { DefaultLearningNeedGenerator } from "@/domain/scheduler";
import {
  NOW,
  USER_ID,
  MasteryStage,
  RetentionState,
  VocabularySkill,
  WeaknessType,
  makeLexeme,
  makeModel,
  makeWeakness,
  sequentialIdFactory,
} from "./helpers";

function generate(
  lexemes: ReturnType<typeof makeLexeme>[],
  models: ReturnType<typeof makeModel>[],
  extra: { now?: string; userMarkedLexemes?: Parameters<DefaultLearningNeedGenerator["generateCandidates"]>[0]["userMarkedLexemes"] } = {},
) {
  return new DefaultLearningNeedGenerator().generateCandidates({
    lexemes,
    models,
    now: extra.now ?? NOW,
    userMarkedLexemes: extra.userMarkedLexemes,
    createId: sequentialIdFactory("need"),
  });
}

describe("Learning Need Generator", () => {
  it("N1: no model / UNSEEN → NEW_WORD + MEANING_RECOGNITION", () => {
    const unseenLexeme = makeLexeme("a", 1);
    const unseenModel = makeModel("b", { masteryStage: MasteryStage.UNSEEN });
    const candidates = generate(
      [unseenLexeme, makeLexeme("b", 2)],
      [unseenModel],
    );
    const newWords = candidates.filter((item) => item.reason === "NEW_WORD");
    expect(newWords).toHaveLength(2);
    expect(newWords.every((item) => item.targetSkill === VocabularySkill.MEANING_RECOGNITION)).toBe(
      true,
    );
    expect(newWords.map((item) => item.lexemeId)).toEqual(["a", "b"]);
  });

  it("N2: EXPOSED → stage progress to MEANING_RECOGNITION", () => {
    const candidates = generate(
      [makeLexeme("ex")],
      [makeModel("ex", { masteryStage: MasteryStage.EXPOSED })],
    );
    expect(
      candidates.some(
        (item) =>
          item.reason === "STAGE_PROGRESS" &&
          item.targetSkill === VocabularySkill.MEANING_RECOGNITION,
      ),
    ).toBe(true);
    expect(candidates.some((item) => item.reason === "NEW_WORD")).toBe(false);
  });

  it("N3: RECOGNIZED → stage progress toward SEMANTIC_CONNECTION", () => {
    const candidates = generate(
      [makeLexeme("rec")],
      [makeModel("rec", { masteryStage: MasteryStage.RECOGNIZED })],
    );
    expect(
      candidates.some(
        (item) =>
          item.reason === "STAGE_PROGRESS" &&
          item.targetSkill === VocabularySkill.SEMANTIC_CONNECTION,
      ),
    ).toBe(true);
  });

  it("N4: CONNECTED with lower ACTIVE_RECALL score → ACTIVE_RECALL", () => {
    const candidates = generate(
      [makeLexeme("con")],
      [
        makeModel("con", {
          masteryStage: MasteryStage.CONNECTED,
          skillScores: {
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.2, confidence: 0.4 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.8, confidence: 0.4 },
          },
        }),
      ],
    );
    const progress = candidates.find((item) => item.reason === "STAGE_PROGRESS");
    expect(progress?.targetSkill).toBe(VocabularySkill.ACTIVE_RECALL);
  });

  it("N5: CONNECTED with lower SPELLING_RECALL score → SPELLING_RECALL", () => {
    const candidates = generate(
      [makeLexeme("con")],
      [
        makeModel("con", {
          masteryStage: MasteryStage.CONNECTED,
          skillScores: {
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.8, confidence: 0.4 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.2, confidence: 0.4 },
          },
        }),
      ],
    );
    const progress = candidates.find((item) => item.reason === "STAGE_PROGRESS");
    expect(progress?.targetSkill).toBe(VocabularySkill.SPELLING_RECALL);
  });

  it("N6: SPELLING weakness → WEAKNESS + SPELLING_RECALL", () => {
    const candidates = generate(
      [makeLexeme("sp")],
      [
        makeModel("sp", {
          masteryStage: MasteryStage.CONNECTED,
          weaknesses: [
            makeWeakness({ id: "w1", type: WeaknessType.SPELLING, severity: 0.7 }),
          ],
        }),
      ],
    );
    const weakness = candidates.find((item) => item.reason === "WEAKNESS");
    expect(weakness?.targetSkill).toBe(VocabularySkill.SPELLING_RECALL);
  });

  it("N7: CONFUSION weakness preserves relatedLexemeId", () => {
    const candidates = generate(
      [makeLexeme("quiet"), makeLexeme("quite")],
      [
        makeModel("quiet", {
          masteryStage: MasteryStage.RECOGNIZED,
          weaknesses: [
            makeWeakness({
              id: "w-conf",
              type: WeaknessType.CONFUSION,
              relatedLexemeId: "quite",
              skill: VocabularySkill.MEANING_RECOGNITION,
            }),
          ],
        }),
      ],
    );
    const weakness = candidates.find((item) => item.reason === "WEAKNESS");
    expect(weakness?.weaknessFocus?.relatedLexemeId).toBe("quite");
  });

  it("N8: future nextReviewAt → no REVIEW_DUE", () => {
    const candidates = generate(
      [makeLexeme("fut")],
      [
        makeModel("fut", {
          masteryStage: MasteryStage.RECOGNIZED,
          nextReviewAt: "2026-12-01T00:00:00.000Z",
        }),
      ],
    );
    expect(candidates.some((item) => item.reason === "REVIEW_DUE")).toBe(false);
  });

  it("N9: past nextReviewAt → REVIEW_DUE", () => {
    const candidates = generate(
      [makeLexeme("due")],
      [
        makeModel("due", {
          masteryStage: MasteryStage.RECOGNIZED,
          nextReviewAt: "2026-09-01T00:00:00.000Z",
        }),
      ],
    );
    expect(candidates.some((item) => item.reason === "REVIEW_DUE")).toBe(true);
  });

  it("N10: FADING → recovery candidate", () => {
    const candidates = generate(
      [makeLexeme("fade")],
      [
        makeModel("fade", {
          masteryStage: MasteryStage.RECALLED,
          retentionState: RetentionState.FADING,
        }),
      ],
    );
    expect(candidates.some((item) => item.reason === "FADING")).toBe(true);
  });

  it("N11: MASTERED + due → REVIEW_DUE still generated", () => {
    const candidates = generate(
      [makeLexeme("mast")],
      [
        makeModel("mast", {
          masteryStage: MasteryStage.MASTERED,
          nextReviewAt: "2026-09-01T00:00:00.000Z",
          skillScores: {
            [VocabularySkill.MEANING_RECOGNITION]: {
              score: 0.9,
              confidence: 0.8,
              attempts: 8,
            },
          },
        }),
      ],
    );
    expect(
      candidates.some(
        (item) => item.reason === "REVIEW_DUE" && item.lexemeId === "mast",
      ),
    ).toBe(true);
    expect(candidates.some((item) => item.reason === "STAGE_PROGRESS")).toBe(false);
  });

  it("N12: USER_MARKED → USER_MARKED candidate", () => {
    const candidates = generate([makeLexeme("mark")], [], {
      userMarkedLexemes: [
        {
          lexemeId: "mark",
          markedAt: NOW,
          preferredSkill: VocabularySkill.ACTIVE_RECALL,
        },
      ],
    });
    const marked = candidates.find((item) => item.reason === "USER_MARKED");
    expect(marked?.targetSkill).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(USER_ID).toBeTruthy();
  });
});
