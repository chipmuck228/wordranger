import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AnswerMode,
  EvidenceOutcome,
  PromptMode,
} from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import {
  SCHEDULER_POLICY_V1,
  SCHEDULER_POLICY_V2,
} from "@/domain/scheduler";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import {
  feed,
  makeEvidence,
  sequentialIdFactory,
  TEST_USER_ID,
} from "../learning/helpers";
import {
  NOW,
  MasteryStage,
  RetentionState,
  makeLexeme,
  makeModel,
  makeWeakness,
  plan,
  policyWith,
} from "./helpers";

const PROBE = ["probe-a", "probe-an", "probe-apple"] as const;
const NEXT = ["next-banana", "next-cat", "next-dog"] as const;

function unseenLexemes(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeLexeme(`unseen-${index}`, index + 1),
  );
}

describe("Vocabulary progression (scheduler v2)", () => {
  it("P1: a new user receives a bounded number of unseen probes", () => {
    const onlyUnseen = plan({
      userId: TEST_USER_ID,
      lexemes: unseenLexemes(40),
      models: [],
      requestedNeedCount: 8,
    });
    expect(onlyUnseen.needs).toHaveLength(8);
    expect(onlyUnseen.needs.every((need) => need.reason === "NEW_WORD")).toBe(true);
    expect(onlyUnseen.needs.length).toBeLessThanOrEqual(8);

    const withReview = plan({
      userId: TEST_USER_ID,
      lexemes: [
        ...Array.from({ length: 8 }, (_, index) => makeLexeme(`rev-${index}`, index + 1)),
        ...unseenLexemes(30).map((item, index) =>
          makeLexeme(item.id, index + 100),
        ),
      ],
      models: Array.from({ length: 8 }, (_, index) =>
        makeModel(`rev-${index}`, {
          masteryStage: MasteryStage.CONNECTED,
          nextReviewAt: "2026-09-01T00:00:00.000Z",
        }),
      ),
      requestedNeedCount: 8,
    });
    const newWords = withReview.needs.filter((need) => need.reason === "NEW_WORD");
    expect(newWords.length).toBeLessThanOrEqual(
      SCHEDULER_POLICY_V2.session.maxNewWords,
    );
  });

  it("P2/P3/P4/P5: strong probes leave the round; new unseen enter; misses stay", async () => {
    const lexemes = [
      ...PROBE.map((id, index) => makeLexeme(id, index + 1)),
      ...NEXT.map((id, index) => makeLexeme(id, index + 10)),
    ];
    const first = plan({
      userId: TEST_USER_ID,
      lexemes,
      models: [],
      requestedNeedCount: 4,
    });
    expect(first.needs.map((need) => need.lexemeId)).toEqual([
      "probe-a",
      "probe-an",
      "probe-apple",
      "next-banana",
    ]);
    expect(first.schedulerPolicyVersion).toBe("v2");

    const learning = new InMemoryLearningRepository();
    const createId = sequentialIdFactory("prog-model");
    for (const lexemeId of ["probe-a", "probe-an", "probe-apple"]) {
      await feed(
        learning,
        makeEvidence(`${lexemeId}-ok`, "round-1", NOW, {
          lexemeId,
          outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
          skill: VocabularySkill.MEANING_RECOGNITION,
          promptMode: PromptMode.WORD_TO_MEANING,
          answerMode: AnswerMode.MULTIPLE_CHOICE,
        }),
        createId,
      );
    }
    await feed(
      learning,
      makeEvidence("next-banana-miss", "round-1", NOW, {
        lexemeId: "next-banana",
        outcome: EvidenceOutcome.INCORRECT,
        skill: VocabularySkill.MEANING_RECOGNITION,
        promptMode: PromptMode.WORD_TO_MEANING,
        answerMode: AnswerMode.MULTIPLE_CHOICE,
      }),
      createId,
    );

    const models = await Promise.all(
      lexemes.map((lexeme) => learning.getStudentLexemeModel(TEST_USER_ID, lexeme.id)),
    );
    const second = plan({
      userId: TEST_USER_ID,
      lexemes,
      models: models.filter((model): model is NonNullable<typeof model> => model !== null),
      requestedNeedCount: 4,
    });
    expect(second.needs.map((need) => need.lexemeId)).not.toEqual(
      first.needs.map((need) => need.lexemeId),
    );
    for (const lexemeId of ["probe-a", "probe-an", "probe-apple"]) {
      expect(
        second.needs.some(
          (need) =>
            need.lexemeId === lexemeId &&
            need.targetSkill === VocabularySkill.MEANING_RECOGNITION,
        ),
      ).toBe(false);
    }
    expect(second.needs.some((need) => need.lexemeId === "next-banana")).toBe(true);
    expect(
      second.needs.some((need) => NEXT.includes(need.lexemeId as (typeof NEXT)[number])),
    ).toBe(true);
    const newlyUnseen = second.needs.filter((need) =>
      ["next-cat", "next-dog"].includes(need.lexemeId),
    );
    expect(newlyUnseen.length).toBeGreaterThan(0);
  });

  it("P6: review/weakness/fading needs are not dropped to admit new words", () => {
    const result = plan({
      lexemes: [
        makeLexeme("weak", 1),
        makeLexeme("fade", 2),
        makeLexeme("due", 3),
        ...unseenLexemes(20).map((item, index) => makeLexeme(item.id, index + 50)),
      ],
      models: [
        makeModel("weak", {
          masteryStage: MasteryStage.CONNECTED,
          weaknesses: [
            makeWeakness({ id: "w-spell", type: WeaknessType.SPELLING, severity: 0.7 }),
          ],
        }),
        makeModel("fade", {
          masteryStage: MasteryStage.RECALLED,
          retentionState: RetentionState.FADING,
        }),
        makeModel("due", {
          masteryStage: MasteryStage.CONNECTED,
          nextReviewAt: "2026-09-01T00:00:00.000Z",
        }),
      ],
      requestedNeedCount: 8,
    });
    const ids = result.needs.map((need) => need.lexemeId);
    expect(ids).toContain("weak");
    expect(ids).toContain("fade");
    expect(ids).toContain("due");
    expect(
      result.needs.filter((need) =>
        ["WEAKNESS", "FADING", "REVIEW_DUE"].includes(need.reason),
      ).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("P7: no hardcoded easy-word mastery shortcut", () => {
    const production = [
      readFileSync(
        join(process.cwd(), "src/domain/scheduler/scheduler-policy.ts"),
        "utf8",
      ),
      readFileSync(
        join(process.cwd(), "src/domain/scheduler/learning-need-generator.ts"),
        "utf8",
      ),
      readFileSync(
        join(process.cwd(), "src/domain/scheduler/stage-progress-deferral.ts"),
        "utf8",
      ),
    ].join("\n");
    expect(production).not.toMatch(/["']apple["']/);
    expect(production).not.toMatch(/["']the["']/);
    expect(production).not.toMatch(/knownWords/);
    const probes = plan({
      lexemes: PROBE.map((id, index) => makeLexeme(id, index + 1)),
      models: [],
      requestedNeedCount: 3,
    });
    expect(probes.needs.every((need) => need.reason === "NEW_WORD")).toBe(true);
    expect(probes.needs.every((need) => need.targetSkill === VocabularySkill.MEANING_RECOGNITION)).toBe(
      true,
    );
  });

  it("P8: progression is deterministic for the same state", () => {
    const lexemes = unseenLexemes(12);
    const first = plan({
      lexemes,
      models: [],
      requestedNeedCount: 8,
    });
    const second = plan({
      lexemes,
      models: [],
      requestedNeedCount: 8,
    });
    expect(second.needs.map((need) => `${need.lexemeId}:${need.reason}`)).toEqual(
      first.needs.map((need) => `${need.lexemeId}:${need.reason}`),
    );
  });

  it("v1 still repeats EXPOSED STAGE_PROGRESS immediately", () => {
    const model = makeModel("probe-a", {
      masteryStage: MasteryStage.EXPOSED,
      lastSuccessAt: NOW,
      nextReviewAt: "2026-09-17T12:00:00.000Z",
    });
    model.skills[VocabularySkill.MEANING_RECOGNITION].consecutiveIndependentSuccesses = 1;
    const v1 = plan({
      lexemes: [makeLexeme("probe-a", 1), makeLexeme("next-cat", 2)],
      models: [model],
      requestedNeedCount: 2,
      policy: SCHEDULER_POLICY_V1,
    });
    expect(
      v1.needs.some(
        (need) => need.lexemeId === "probe-a" && need.reason === "STAGE_PROGRESS",
      ),
    ).toBe(true);
    const v2 = plan({
      lexemes: [makeLexeme("probe-a", 1), makeLexeme("next-cat", 2)],
      models: [model],
      requestedNeedCount: 2,
      policy: policyWith({
        version: "v2",
        progression: { deferHealthyStageProgressUntilReviewDue: true },
      }),
    });
    expect(v2.needs.some((need) => need.lexemeId === "probe-a")).toBe(false);
    expect(v2.needs.some((need) => need.lexemeId === "next-cat")).toBe(true);
  });
});
