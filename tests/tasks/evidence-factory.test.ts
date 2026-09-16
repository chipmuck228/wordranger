import { describe, expect, it } from "vitest";
import { EvidenceErrorType } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { createLearningEvidenceFromTaskEvaluation } from "@/domain/tasks/evidence-factory";
import { DefaultTaskEvaluator } from "@/domain/tasks/default-task-evaluator";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { sequentialIdFactory } from "../learning/helpers";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { makeNeed, makeNeedWithConfusion } from "./helpers";

const NOW = "2026-03-01T09:00:00.000Z";
const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
const generator = new DefaultTaskGenerator(vocabulary);
const evaluator = new DefaultTaskEvaluator();

describe("Evidence factory", () => {
  it("TEST F1-F3: copies lexemeId, taskId, and keeps gameId distinct from taskType", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const generated = await generator.generate({
      need: makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("f"),
      random: new SeededRandomSource("factory"),
    });
    if (generated.status !== "GENERATED") {
      throw new Error(generated.reason);
    }
    const evaluation = evaluator.evaluate(
      generated.value.publicTask,
      generated.value.answerKey,
      {
        kind: "CHOICE",
        taskId: generated.value.publicTask.id,
        optionId: generated.value.answerKey.correctOptionIds[0],
        hintCount: 0,
        responseTimeMs: 500,
        occurredAt: NOW,
      },
    );
    const evidence = createLearningEvidenceFromTaskEvaluation({
      task: generated.value.publicTask,
      answerKey: generated.value.answerKey,
      evaluation,
      userId: "user-1",
      sessionId: "session-1",
      gameId: "debug-task-lab",
      evidenceId: "ev-1",
    });
    expect(evidence.lexemeId).toBe(quiet.id);
    expect(evidence.taskId).toBe(generated.value.publicTask.id);
    expect(evidence.gameId).toBe("debug-task-lab");
    expect(evidence.taskType).toBe(generated.value.publicTask.taskType);
    expect(evidence.gameId).not.toBe(evidence.taskType);
  });

  it("TEST F4: CONFUSED_WITH_WORD keeps selectedLexemeId", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const [quite] = await vocabulary.findLexemeByLemma("quite");
    const generated = await generator.generate({
      need: makeNeedWithConfusion(quiet.id, quite.id),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("f"),
      random: new SeededRandomSource("factory-c"),
    });
    if (generated.status !== "GENERATED") {
      throw new Error(generated.reason);
    }
    const wrong = Object.entries(generated.value.answerKey.optionLexemeIds).find(
      ([, lexemeId]) => lexemeId === quite.id,
    )!;
    const evaluation = evaluator.evaluate(
      generated.value.publicTask,
      generated.value.answerKey,
      {
        kind: "CHOICE",
        taskId: generated.value.publicTask.id,
        optionId: wrong[0],
        hintCount: 0,
        responseTimeMs: 500,
        occurredAt: NOW,
      },
    );
    const evidence = createLearningEvidenceFromTaskEvaluation({
      task: generated.value.publicTask,
      answerKey: generated.value.answerKey,
      evaluation,
      userId: "user-1",
      sessionId: "session-1",
      gameId: "debug-task-lab",
      evidenceId: "ev-2",
    });
    expect(evidence.errorType).toBe(EvidenceErrorType.CONFUSED_WITH_WORD);
    expect(evidence.selectedLexemeId).toBe(quite.id);
  });

  it("TEST F5: spelling error type is preserved", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const generated = await generator.generate({
      need: makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.SPELLING_RECALL,
      }),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("f"),
      random: new SeededRandomSource("factory-s"),
    });
    if (generated.status !== "GENERATED") {
      throw new Error(generated.reason);
    }
    const evaluation = evaluator.evaluate(
      generated.value.publicTask,
      generated.value.answerKey,
      {
        kind: "TEXT_INPUT",
        taskId: generated.value.publicTask.id,
        value: "zzzzzz",
        hintCount: 0,
        responseTimeMs: 400,
        occurredAt: NOW,
      },
    );
    const evidence = createLearningEvidenceFromTaskEvaluation({
      task: generated.value.publicTask,
      answerKey: generated.value.answerKey,
      evaluation,
      userId: "user-1",
      sessionId: "session-1",
      gameId: "debug-task-lab",
      evidenceId: "ev-3",
    });
    expect(evidence.errorType).toBe(EvidenceErrorType.SPELLING_MAJOR);
    expect(evidence.taskType).toBe("SPELLING_RECALL_TYPING");
  });
});
