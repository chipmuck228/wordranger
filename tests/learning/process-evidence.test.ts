import { describe, expect, it } from "vitest";
import {
  AnswerMode,
  EvidenceErrorType,
  EvidenceOutcome,
  PromptMode,
} from "@/domain/learning/evidence.types";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { RetentionState } from "@/domain/learning/retention-state";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { processEvidence } from "@/domain/learning/engine/process-evidence";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import {
  CONFUSED_WORD_ID,
  daysAfter,
  feed,
  feedAll,
  makeEvidence,
  sequentialIdFactory,
} from "./helpers";

const T0 = "2026-03-01T09:00:00.000Z";

function repo() {
  return {
    repository: new InMemoryLearningRepository(),
    createId: sequentialIdFactory("gen"),
  };
}

function meaning(
  id: string,
  sessionId: string,
  occurredAt: string,
  outcome = EvidenceOutcome.INDEPENDENT_CORRECT,
) {
  return makeEvidence(id, sessionId, occurredAt, {
    skill: VocabularySkill.MEANING_RECOGNITION,
    outcome,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    taskType: "meaning-choice",
  });
}

function semantic(id: string, sessionId: string, occurredAt: string) {
  return makeEvidence(id, sessionId, occurredAt, {
    skill: VocabularySkill.SEMANTIC_CONNECTION,
    outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
    promptMode: PromptMode.WORD_TO_RELATION,
    answerMode: AnswerMode.MATCHING,
    taskType: "relation-match",
  });
}

function recall(id: string, sessionId: string, occurredAt: string) {
  return makeEvidence(id, sessionId, occurredAt, {
    skill: VocabularySkill.ACTIVE_RECALL,
    outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
    promptMode: PromptMode.MEANING_TO_WORD,
    answerMode: AnswerMode.TYPING,
    taskType: "recall-typing",
    typedAnswer: "quiet",
    expectedAnswer: "quiet",
  });
}

function spellingSuccess(id: string, sessionId: string, occurredAt: string) {
  return makeEvidence(id, sessionId, occurredAt, {
    skill: VocabularySkill.SPELLING_RECALL,
    outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
    promptMode: PromptMode.AUDIO_TO_SPELLING,
    answerMode: AnswerMode.SPELLING,
    taskType: "spelling-dictation",
    typedAnswer: "quiet",
    expectedAnswer: "quiet",
  });
}

function contextUse(
  id: string,
  sessionId: string,
  occurredAt: string,
  variant: string,
) {
  return makeEvidence(id, sessionId, occurredAt, {
    skill: VocabularySkill.CONTEXT_USE,
    outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
    promptMode: PromptMode.CONTEXT_TO_WORD,
    answerMode: AnswerMode.TYPING,
    taskType: "context-gap",
    metadata: { contextId: variant },
    typedAnswer: "quiet",
    expectedAnswer: "quiet",
  });
}

function pathToRecognized() {
  return [
    meaning("rec-1", "session-a", T0),
    meaning("rec-2", "session-b", daysAfter(T0, 1)),
  ];
}

function pathToConnected() {
  return [
    ...pathToRecognized(),
    meaning("con-m3", "session-a", daysAfter(T0, 0.01)),
    meaning("con-m4", "session-b", daysAfter(T0, 1.01)),
    meaning("con-m5", "session-b", daysAfter(T0, 1.02)),
    meaning("con-m6", "session-b", daysAfter(T0, 1.03)),
    meaning("con-m7", "session-b", daysAfter(T0, 1.04)),
    semantic("con-s1", "session-a", daysAfter(T0, 0.02)),
    semantic("con-s2", "session-b", daysAfter(T0, 1.05)),
    semantic("con-s3", "session-b", daysAfter(T0, 1.06)),
    semantic("con-s4", "session-b", daysAfter(T0, 1.07)),
  ];
}

function pathToRecalled() {
  return [
    ...pathToConnected(),
    recall("rcl-1", "session-c", daysAfter(T0, 2)),
    recall("rcl-2", "session-d", daysAfter(T0, 3)),
    recall("rcl-3", "session-d", daysAfter(T0, 3.01)),
    recall("rcl-4", "session-d", daysAfter(T0, 3.02)),
    recall("rcl-5", "session-d", daysAfter(T0, 3.03)),
  ];
}

function pathToUsable() {
  return [
    ...pathToRecalled(),
    contextUse("use-1", "session-e", daysAfter(T0, 4), "school"),
    contextUse("use-2", "session-e", daysAfter(T0, 4.01), "home"),
    contextUse("use-3", "session-f", daysAfter(T0, 4.02), "school"),
    contextUse("use-4", "session-f", daysAfter(T0, 4.03), "home"),
    contextUse("use-5", "session-f", daysAfter(T0, 4.04), "park"),
  ];
}

function pathToMastered() {
  return [
    ...pathToUsable(),
    meaning("mas-m8", "session-g", daysAfter(T0, 5)),
    meaning("mas-m9", "session-g", daysAfter(T0, 5.01)),
    spellingSuccess("mas-sp1", "session-g", daysAfter(T0, 5.02)),
    recall("mas-r6", "session-h", daysAfter(T0, 7)),
    contextUse("mas-c6", "session-h", daysAfter(T0, 7.01), "exam"),
  ];
}

describe("processEvidence", () => {
  it("TEST 1: first incorrect answer moves UNSEEN to EXPOSED", async () => {
    const { repository, createId } = repo();
    const { model } = await feed(
      repository,
      meaning("t1", "s1", T0, EvidenceOutcome.INCORRECT),
      createId,
    );
    expect(model.masteryStage).toBe(MasteryStage.EXPOSED);
  });

  it("TEST 2: SKIPPED does not promote UNSEEN", async () => {
    const { repository, createId } = repo();
    const { model } = await feed(
      repository,
      meaning("t2", "s1", T0, EvidenceOutcome.SKIPPED),
      createId,
    );
    expect(model.masteryStage).toBe(MasteryStage.UNSEEN);
  });

  it("TEST 3: five recognition successes in one session do not reach RECOGNIZED", async () => {
    const { repository, createId } = repo();
    const items = Array.from({ length: 5 }, (_, index) =>
      meaning(`t3-${index}`, "same-session", daysAfter(T0, index / 100)),
    );
    const { model } = await feedAll(repository, items, createId);
    expect(model.masteryStage).toBe(MasteryStage.EXPOSED);
    expect(model.masteryStage).not.toBe(MasteryStage.RECOGNIZED);
  });

  it("TEST 4: independent recognition across two sessions reaches RECOGNIZED", async () => {
    const { repository, createId } = repo();
    const { model } = await feedAll(repository, pathToRecognized(), createId);
    expect(model.masteryStage).toBe(MasteryStage.RECOGNIZED);
  });

  it("TEST 5: multiple-choice correctness cannot reach RECALLED", async () => {
    const { repository, createId } = repo();
    const items = [
      ...pathToConnected(),
      ...Array.from({ length: 8 }, (_, index) =>
        makeEvidence(`t5-${index}`, `mc-session-${index}`, daysAfter(T0, 2 + index), {
          skill: VocabularySkill.ACTIVE_RECALL,
          outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
          answerMode: AnswerMode.MULTIPLE_CHOICE,
          promptMode: PromptMode.MEANING_TO_WORD,
          taskType: "recall-choice",
        }),
      ),
    ];
    const { model } = await feedAll(repository, items, createId);
    expect(model.masteryStage).not.toBe(MasteryStage.RECALLED);
    expect(model.masteryStage).not.toBe(MasteryStage.USABLE);
    expect(model.masteryStage).not.toBe(MasteryStage.MASTERED);
  });

  it("TEST 6: unassisted production promotes CONNECTED to RECALLED", async () => {
    const { repository, createId } = repo();
    const { model } = await feedAll(repository, pathToRecalled(), createId);
    expect(model.masteryStage).toBe(MasteryStage.RECALLED);
  });

  it("TEST 7: same-day grinding cannot promote USABLE to MASTERED", async () => {
    const { repository, createId } = repo();
    const sameDayGrind = Array.from({ length: 12 }, (_, index) =>
      recall(`grind-${index}`, "grind-session", daysAfter(T0, 4.1 + index / 100)),
    );
    const { model } = await feedAll(
      repository,
      [...pathToUsable(), ...sameDayGrind],
      createId,
    );
    expect(model.masteryStage).toBe(MasteryStage.USABLE);
    expect(model.masteryStage).not.toBe(MasteryStage.MASTERED);
  });

  it("TEST 8: diverse evidence over 7+ days can reach MASTERED", async () => {
    const { repository, createId } = repo();
    const { model } = await feedAll(repository, pathToMastered(), createId);
    expect(model.masteryStage).toBe(MasteryStage.MASTERED);
    expect(model.distinctPracticeDays).toBeGreaterThanOrEqual(3);
    expect(model.distinctTaskTypes).toBeGreaterThanOrEqual(3);
    expect(model.masteryScore).toBeGreaterThan(0);
  });

  it("TEST 9: one spelling error on MASTERED fades and tags SPELLING, without demoting", async () => {
    const { repository, createId } = repo();
    await feedAll(repository, pathToMastered(), createId);
    const { model, transition } = await feed(
      repository,
      makeEvidence("spell-fail", "session-fail", daysAfter(T0, 8), {
        skill: VocabularySkill.SPELLING_RECALL,
        outcome: EvidenceOutcome.INCORRECT,
        answerMode: AnswerMode.SPELLING,
        promptMode: PromptMode.AUDIO_TO_SPELLING,
        taskType: "spelling-dictation",
        errorType: EvidenceErrorType.SPELLING_MAJOR,
        typedAnswer: "quete",
        expectedAnswer: "quiet",
      }),
      createId,
    );
    expect(model.masteryStage).toBe(MasteryStage.MASTERED);
    expect(model.retentionState).toBe(RetentionState.FADING);
    expect(
      model.weaknesses.some(
        (weakness) =>
          weakness.type === WeaknessType.SPELLING && weakness.resolvedAt === null,
      ),
    ).toBe(true);
    expect(
      transition.reasons.some((reason) => reason.code.includes("FADING")),
    ).toBe(true);
  });

  it("TEST 10: first success after FADING becomes RECOVERING, not STABLE", async () => {
    const { repository, createId } = repo();
    await feedAll(repository, pathToMastered(), createId);
    await feed(
      repository,
      makeEvidence("fade", "session-fail", daysAfter(T0, 8), {
        skill: VocabularySkill.SPELLING_RECALL,
        outcome: EvidenceOutcome.INCORRECT,
        answerMode: AnswerMode.SPELLING,
        errorType: EvidenceErrorType.SPELLING_MAJOR,
        taskType: "spelling-dictation",
      }),
      createId,
    );
    const { model } = await feed(
      repository,
      spellingSuccess("recover-1", "session-fail", daysAfter(T0, 8.01)),
      createId,
    );
    expect(model.retentionState).toBe(RetentionState.RECOVERING);
    expect(model.retentionState).not.toBe(RetentionState.STABLE);
  });

  it("TEST 11: RECOVERING plus later independent success in a new session returns STABLE", async () => {
    const { repository, createId } = repo();
    await feedAll(repository, pathToMastered(), createId);
    await feed(
      repository,
      makeEvidence("fade", "session-fail", daysAfter(T0, 8), {
        skill: VocabularySkill.SPELLING_RECALL,
        outcome: EvidenceOutcome.INCORRECT,
        answerMode: AnswerMode.SPELLING,
        errorType: EvidenceErrorType.SPELLING_MAJOR,
        taskType: "spelling-dictation",
      }),
      createId,
    );
    await feed(
      repository,
      spellingSuccess("recover-1", "session-fail", daysAfter(T0, 8.01)),
      createId,
    );
    const { model } = await feed(
      repository,
      spellingSuccess("recover-2", "session-stable", daysAfter(T0, 9)),
      createId,
    );
    expect(model.retentionState).toBe(RetentionState.STABLE);
  });

  it("TEST 12: two incorrect attempts in the last three of a skill create a weakness", async () => {
    const { repository, createId } = repo();
    const { model } = await feedAll(
      repository,
      [
        meaning("w1", "s1", T0, EvidenceOutcome.INCORRECT),
        meaning("w2", "s1", daysAfter(T0, 0.01), EvidenceOutcome.INCORRECT),
        meaning("w3", "s1", daysAfter(T0, 0.02)),
      ],
      createId,
    );
    expect(
      model.weaknesses.some(
        (weakness) =>
          weakness.type === WeaknessType.MEANING && weakness.resolvedAt === null,
      ),
    ).toBe(true);
  });

  it("TEST 13: retriggering a weakness updates it instead of duplicating", async () => {
    const { repository, createId } = repo();
    await feedAll(
      repository,
      [
        meaning("w1", "s1", T0, EvidenceOutcome.INCORRECT),
        meaning("w2", "s1", daysAfter(T0, 0.01), EvidenceOutcome.INCORRECT),
      ],
      createId,
    );
    const { model } = await feed(
      repository,
      meaning("w3", "s2", daysAfter(T0, 1), EvidenceOutcome.INCORRECT),
      createId,
    );
    const meaningWeaknesses = model.weaknesses.filter(
      (weakness) =>
        weakness.type === WeaknessType.MEANING && weakness.resolvedAt === null,
    );
    expect(meaningWeaknesses).toHaveLength(1);
    expect(meaningWeaknesses[0]?.reason.evidenceIds.length).toBeGreaterThan(1);
  });

  it("TEST 14: repeatedly choosing quite for quiet creates CONFUSION", async () => {
    const { repository, createId } = repo();
    const confused = (id: string, sessionId: string, occurredAt: string) =>
      makeEvidence(id, sessionId, occurredAt, {
        outcome: EvidenceOutcome.INCORRECT,
        selectedWordId: CONFUSED_WORD_ID,
        errorType: EvidenceErrorType.CONFUSED_WITH_WORD,
        distractorWordIds: [CONFUSED_WORD_ID],
      });
    const { model } = await feedAll(
      repository,
      [confused("c1", "s1", T0), confused("c2", "s2", daysAfter(T0, 1))],
      createId,
    );
    const confusion = model.weaknesses.find(
      (weakness) => weakness.type === WeaknessType.CONFUSION,
    );
    expect(confusion?.relatedWordId).toBe(CONFUSED_WORD_ID);
  });

  it("TEST 15: ASSISTED_CORRECT increases score less than INDEPENDENT_CORRECT", async () => {
    const independentRepo = new InMemoryLearningRepository();
    const assistedRepo = new InMemoryLearningRepository();
    const independent = await feed(
      independentRepo,
      makeEvidence("ind", "s1", T0, {
        skill: VocabularySkill.ACTIVE_RECALL,
        outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
        answerMode: AnswerMode.TYPING,
        wordId: "word-a",
      }),
    );
    const assisted = await feed(
      assistedRepo,
      makeEvidence("ast", "s1", T0, {
        skill: VocabularySkill.ACTIVE_RECALL,
        outcome: EvidenceOutcome.ASSISTED_CORRECT,
        answerMode: AnswerMode.TYPING,
        hintCount: 2,
        wordId: "word-b",
      }),
    );
    const independentScore =
      independent.model.skills[VocabularySkill.ACTIVE_RECALL].score;
    const assistedScore =
      assisted.model.skills[VocabularySkill.ACTIVE_RECALL].score;
    expect(independentScore).toBeGreaterThan(assistedScore);
    expect(independentScore - assistedScore).toBeGreaterThan(0.08);
  });

  it("TEST 16: one success cannot set confidence to 1; more sessions raise it", async () => {
    const { repository, createId } = repo();
    const first = await feed(repository, meaning("cf-1", "s1", T0), createId);
    expect(
      first.model.skills[VocabularySkill.MEANING_RECOGNITION].confidence,
    ).toBeLessThan(0.5);
    expect(
      first.model.skills[VocabularySkill.MEANING_RECOGNITION].confidence,
    ).toBeLessThan(1);
    const later = await feedAll(
      repository,
      [
        meaning("cf-2", "s2", daysAfter(T0, 1)),
        meaning("cf-3", "s3", daysAfter(T0, 2)),
        meaning("cf-4", "s4", daysAfter(T0, 3)),
      ],
      createId,
    );
    expect(
      later.model.skills[VocabularySkill.MEANING_RECOGNITION].confidence,
    ).toBeGreaterThan(
      first.model.skills[VocabularySkill.MEANING_RECOGNITION].confidence,
    );
  });

  it("TEST 17: score, confidence, and severity stay clamped to 0..1", async () => {
    const { repository, createId } = repo();
    const { model } = await feedAll(repository, pathToMastered(), createId);
    const values = [
      model.masteryScore,
      model.masteryConfidence,
      ...Object.values(model.skills).flatMap((skill) => [
        skill.score,
        skill.confidence,
      ]),
      ...model.weaknesses.map((weakness) => weakness.severity),
    ];
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("rejects evidence outside unit interval at the domain boundary", async () => {
    const { repository, createId } = repo();
    await expect(
      processEvidence({
        evidence: meaning("bad", "s1", T0),
        repository,
        createId,
      }),
    ).resolves.toBeTruthy();

    const invalid = meaning("bad-diff", "s1", T0);
    invalid.difficulty = 1.4;
    await expect(
      processEvidence({
        evidence: invalid,
        repository,
        createId,
      }),
    ).rejects.toThrow(/difficulty/i);
  });
});
