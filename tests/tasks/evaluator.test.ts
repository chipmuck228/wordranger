import { describe, expect, it } from "vitest";
import {
  EvidenceErrorType,
  EvidenceOutcome,
} from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { DefaultTaskEvaluator } from "@/domain/tasks/default-task-evaluator";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { TaskProtocolError } from "@/domain/tasks/task-evaluator";
import { sequentialIdFactory } from "../learning/helpers";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { makeNeed, makeNeedWithConfusion } from "./helpers";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";

const NOW = "2026-03-01T09:00:00.000Z";
const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
const generator = new DefaultTaskGenerator(vocabulary);
const evaluator = new DefaultTaskEvaluator();

async function meaningTask(): Promise<GeneratedLearningTask> {
  const [quiet] = await vocabulary.findLexemeByLemma("quiet");
  const result = await generator.generate({
    need: makeNeed({
      lexemeId: quiet.id,
      targetSkill: VocabularySkill.MEANING_RECOGNITION,
    }),
    desiredDifficulty: 0.4,
    recentTasks: [],
    now: NOW,
    createId: sequentialIdFactory("e"),
    random: new SeededRandomSource("eval"),
  });
  if (result.status !== "GENERATED") {
    throw new Error(result.reason);
  }
  return result.value;
}

describe("TaskEvaluator", () => {
  it("TEST E1: correct choice with hintCount 0 is INDEPENDENT_CORRECT", async () => {
    const generated = await meaningTask();
    const optionId = generated.answerKey.correctOptionIds[0];
    const evaluation = evaluator.evaluate(
      generated.publicTask,
      generated.answerKey,
      {
        kind: "CHOICE",
        taskId: generated.publicTask.id,
        optionId,
        hintCount: 0,
        responseTimeMs: 900,
        occurredAt: NOW,
      },
    );
    expect(evaluation.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    expect(evaluation.isCorrect).toBe(true);
  });

  it("TEST E2: correct choice with hintCount > 0 is ASSISTED_CORRECT", async () => {
    const generated = await meaningTask();
    const evaluation = evaluator.evaluate(
      generated.publicTask,
      generated.answerKey,
      {
        kind: "CHOICE",
        taskId: generated.publicTask.id,
        optionId: generated.answerKey.correctOptionIds[0],
        hintCount: 1,
        responseTimeMs: 900,
        occurredAt: NOW,
      },
    );
    expect(evaluation.outcome).toBe(EvidenceOutcome.ASSISTED_CORRECT);
  });

  it("TEST E3: wrong choice is INCORRECT", async () => {
    const generated = await meaningTask();
    const wrong = Object.keys(generated.answerKey.optionLexemeIds).find(
      (id) => !generated.answerKey.correctOptionIds.includes(id),
    )!;
    const evaluation = evaluator.evaluate(
      generated.publicTask,
      generated.answerKey,
      {
        kind: "CHOICE",
        taskId: generated.publicTask.id,
        optionId: wrong,
        hintCount: 0,
        responseTimeMs: 900,
        occurredAt: NOW,
      },
    );
    expect(evaluation.outcome).toBe(EvidenceOutcome.INCORRECT);
  });

  it("TEST E4: known confusion wrong option sets CONFUSED_WITH_WORD", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const [quite] = await vocabulary.findLexemeByLemma("quite");
    const result = await generator.generate({
      need: makeNeedWithConfusion(quiet.id, quite.id),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("c"),
      random: new SeededRandomSource("confusion"),
    });
    expect(result.status).toBe("GENERATED");
    if (result.status !== "GENERATED") {
      return;
    }
    const wrongOption = Object.entries(result.value.answerKey.optionLexemeIds).find(
      ([, lexemeId]) => lexemeId === quite.id,
    );
    expect(wrongOption).toBeTruthy();
    const evaluation = evaluator.evaluate(
      result.value.publicTask,
      result.value.answerKey,
      {
        kind: "CHOICE",
        taskId: result.value.publicTask.id,
        optionId: wrongOption![0],
        hintCount: 0,
        responseTimeMs: 800,
        occurredAt: NOW,
      },
    );
    expect(evaluation.errorType).toBe(EvidenceErrorType.CONFUSED_WITH_WORD);
    expect(evaluation.selectedLexemeId).toBe(quite.id);
  });

  it("TEST E5: a normal meaning error is WRONG_MEANING", async () => {
    const generated = await meaningTask();
    const quiteId = (await vocabulary.findLexemeByLemma("quite"))[0].id;
    const wrong = Object.entries(generated.answerKey.optionLexemeIds).find(
      ([id, lexemeId]) =>
        !generated.answerKey.correctOptionIds.includes(id) &&
        lexemeId !== quiteId,
    );
    if (!wrong) {
      return;
    }
    const evaluation = evaluator.evaluate(
      generated.publicTask,
      generated.answerKey,
      {
        kind: "CHOICE",
        taskId: generated.publicTask.id,
        optionId: wrong[0],
        hintCount: 0,
        responseTimeMs: 800,
        occurredAt: NOW,
      },
    );
    expect(evaluation.errorType).toBe(EvidenceErrorType.WRONG_MEANING);
  });

  it("TEST E6: exact spelling is correct", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generator.generate({
      need: makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.SPELLING_RECALL,
      }),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("s"),
      random: new SeededRandomSource("spell"),
    });
    if (result.status !== "GENERATED") {
      throw new Error(result.reason);
    }
    const evaluation = evaluator.evaluate(
      result.value.publicTask,
      result.value.answerKey,
      {
        kind: "TEXT_INPUT",
        taskId: result.value.publicTask.id,
        value: " Quiet ",
        hintCount: 0,
        responseTimeMs: 700,
        occurredAt: NOW,
      },
    );
    expect(evaluation.isCorrect).toBe(true);
    expect(evaluation.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
  });

  it("TEST E7: minor typo is SPELLING_MINOR", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generator.generate({
      need: makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.SPELLING_RECALL,
      }),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("s"),
      random: new SeededRandomSource("spell"),
    });
    if (result.status !== "GENERATED") {
      throw new Error(result.reason);
    }
    const evaluation = evaluator.evaluate(
      result.value.publicTask,
      result.value.answerKey,
      {
        kind: "TEXT_INPUT",
        taskId: result.value.publicTask.id,
        value: "quiat",
        hintCount: 0,
        responseTimeMs: 700,
        occurredAt: NOW,
      },
    );
    expect(evaluation.errorType).toBe(EvidenceErrorType.SPELLING_MINOR);
    expect(evaluation.outcome).toBe(EvidenceOutcome.INCORRECT);
  });

  it("TEST E8: major typo is SPELLING_MAJOR", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generator.generate({
      need: makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.SPELLING_RECALL,
      }),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("s"),
      random: new SeededRandomSource("spell"),
    });
    if (result.status !== "GENERATED") {
      throw new Error(result.reason);
    }
    const evaluation = evaluator.evaluate(
      result.value.publicTask,
      result.value.answerKey,
      {
        kind: "TEXT_INPUT",
        taskId: result.value.publicTask.id,
        value: "zzzzzz",
        hintCount: 0,
        responseTimeMs: 700,
        occurredAt: NOW,
      },
    );
    expect(evaluation.errorType).toBe(EvidenceErrorType.SPELLING_MAJOR);
  });

  it("TEST E9: invalid option id is rejected", async () => {
    const generated = await meaningTask();
    expect(() =>
      evaluator.evaluate(generated.publicTask, generated.answerKey, {
        kind: "CHOICE",
        taskId: generated.publicTask.id,
        optionId: "missing-option",
        hintCount: 0,
        responseTimeMs: 1,
        occurredAt: NOW,
      }),
    ).toThrow(TaskProtocolError);
  });

  it("TEST E10: CHOICE task + TEXT_INPUT action is rejected", async () => {
    const generated = await meaningTask();
    expect(() =>
      evaluator.evaluate(generated.publicTask, generated.answerKey, {
        kind: "TEXT_INPUT",
        taskId: generated.publicTask.id,
        value: "quiet",
        hintCount: 0,
        responseTimeMs: 1,
        occurredAt: NOW,
      }),
    ).toThrow(/CHOICE task/);
  });

  it("TEST E11: taskId mismatch is rejected", async () => {
    const generated = await meaningTask();
    expect(() =>
      evaluator.evaluate(generated.publicTask, generated.answerKey, {
        kind: "CHOICE",
        taskId: "other-task",
        optionId: generated.answerKey.correctOptionIds[0],
        hintCount: 0,
        responseTimeMs: 1,
        occurredAt: NOW,
      }),
    ).toThrow(/does not match/);
  });

  it("TEST E12: correct + hint cannot become INDEPENDENT_CORRECT", async () => {
    const generated = await meaningTask();
    const evaluation = evaluator.evaluate(
      generated.publicTask,
      generated.answerKey,
      {
        kind: "CHOICE",
        taskId: generated.publicTask.id,
        optionId: generated.answerKey.correctOptionIds[0],
        hintCount: 2,
        responseTimeMs: 1,
        occurredAt: NOW,
      },
    );
    expect(evaluation.outcome).not.toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    expect(evaluation.outcome).toBe(EvidenceOutcome.ASSISTED_CORRECT);
  });
});
