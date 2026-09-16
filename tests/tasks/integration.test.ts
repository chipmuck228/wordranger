import { describe, expect, it } from "vitest";
import { EvidenceErrorType } from "@/domain/learning/evidence.types";
import { processEvidence } from "@/domain/learning/engine/process-evidence";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { createLearningEvidenceFromTaskEvaluation } from "@/domain/tasks/evidence-factory";
import { DefaultTaskEvaluator } from "@/domain/tasks/default-task-evaluator";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { sequentialIdFactory } from "../learning/helpers";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { makeNeed, makeNeedWithConfusion } from "./helpers";

const T0 = "2026-03-01T09:00:00.000Z";
const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
const generator = new DefaultTaskGenerator(vocabulary);
const evaluator = new DefaultTaskEvaluator();

describe("Task protocol integration", () => {
  it("TEST I1: Need → Task → Action → Evidence → processEvidence", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const generated = await generator.generate({
      need: makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: T0,
      createId: sequentialIdFactory("i1"),
      random: new SeededRandomSource("i1"),
    });
    expect(generated.status).toBe("GENERATED");
    if (generated.status !== "GENERATED") {
      return;
    }
    const evaluation = evaluator.evaluate(
      generated.value.publicTask,
      generated.value.answerKey,
      {
        kind: "CHOICE",
        taskId: generated.value.publicTask.id,
        optionId: generated.value.answerKey.correctOptionIds[0],
        hintCount: 0,
        responseTimeMs: 900,
        occurredAt: T0,
      },
    );
    const evidence = createLearningEvidenceFromTaskEvaluation({
      task: generated.value.publicTask,
      answerKey: generated.value.answerKey,
      evaluation,
      userId: "user-i1",
      sessionId: "s1",
      gameId: "debug-task-lab",
      evidenceId: "ev-i1",
    });
    const result = await processEvidence({
      evidence,
      repository: new InMemoryLearningRepository(),
      now: T0,
    });
    expect(result.model.lexemeId).toBe(quiet.id);
    expect(result.model.masteryStage).toBe(MasteryStage.EXPOSED);
    expect(result.model.evidenceCount).toBe(1);
  });

  it("TEST I2: quiet → quite twice produces CONFUSION via the pipeline", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const [quite] = await vocabulary.findLexemeByLemma("quite");
    const learning = new InMemoryLearningRepository();
    for (const [index, occurredAt] of [
      T0,
      "2026-03-02T09:00:00.000Z",
    ].entries()) {
      const generated = await generator.generate({
        need: makeNeedWithConfusion(quiet.id, quite.id),
        desiredDifficulty: 0.4,
        recentTasks: [],
        now: occurredAt,
        createId: sequentialIdFactory(`i2-${index}`),
        random: new SeededRandomSource(`i2-${index}`),
      });
      if (generated.status !== "GENERATED") {
        throw new Error(generated.reason);
      }
      const wrong = Object.entries(
        generated.value.answerKey.optionLexemeIds,
      ).find(([, lexemeId]) => lexemeId === quite.id);
      expect(wrong).toBeTruthy();
      const evaluation = evaluator.evaluate(
        generated.value.publicTask,
        generated.value.answerKey,
        {
          kind: "CHOICE",
          taskId: generated.value.publicTask.id,
          optionId: wrong![0],
          hintCount: 0,
          responseTimeMs: 800,
          occurredAt,
        },
      );
      expect(evaluation.errorType).toBe(EvidenceErrorType.CONFUSED_WITH_WORD);
      const evidence = createLearningEvidenceFromTaskEvaluation({
        task: generated.value.publicTask,
        answerKey: generated.value.answerKey,
        evaluation,
        userId: "user-i2",
        sessionId: `s${index}`,
        gameId: "debug-task-lab",
        evidenceId: `ev-i2-${index}`,
      });
      await processEvidence({
        evidence,
        repository: learning,
        now: occurredAt,
      });
    }
    const model = await learning.getStudentLexemeModel("user-i2", quiet.id);
    const confusion = model?.weaknesses.find(
      (weakness) => weakness.type === WeaknessType.CONFUSION,
    );
    expect(confusion?.relatedLexemeId).toBe(quite.id);
  });

  it("TEST I3: ACTIVE_RECALL typing contributes recall evidence", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const generated = await generator.generate({
      need: makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.ACTIVE_RECALL,
      }),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: T0,
      createId: sequentialIdFactory("i3"),
      random: new SeededRandomSource("i3"),
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
        value: "quiet",
        hintCount: 0,
        responseTimeMs: 900,
        occurredAt: T0,
      },
    );
    const evidence = createLearningEvidenceFromTaskEvaluation({
      task: generated.value.publicTask,
      answerKey: generated.value.answerKey,
      evaluation,
      userId: "user-i3",
      sessionId: "s1",
      gameId: "debug-task-lab",
      evidenceId: "ev-i3",
    });
    expect(evidence.skill).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(evidence.answerMode).toBe("TYPING");
    const result = await processEvidence({
      evidence,
      repository: new InMemoryLearningRepository(),
      now: T0,
    });
    expect(
      result.model.skills[VocabularySkill.ACTIVE_RECALL].totalAttempts,
    ).toBe(1);
  });

  it("TEST I4: MEANING_CHOICE cannot satisfy the recall gate", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const learning = new InMemoryLearningRepository();
    let stage = MasteryStage.UNSEEN;
    for (let index = 0; index < 4; index += 1) {
      const generated = await generator.generate({
        need: makeNeed({
          lexemeId: quiet.id,
          targetSkill: VocabularySkill.MEANING_RECOGNITION,
        }),
        desiredDifficulty: 0.4,
        recentTasks: [],
        now: index < 2 ? T0 : "2026-03-02T09:00:00.000Z",
        createId: sequentialIdFactory(`i4-${index}`),
        random: new SeededRandomSource(`i4-${index}`),
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
          responseTimeMs: 700,
          occurredAt: index < 2 ? T0 : "2026-03-02T09:00:00.000Z",
        },
      );
      const evidence = createLearningEvidenceFromTaskEvaluation({
        task: generated.value.publicTask,
        answerKey: generated.value.answerKey,
        evaluation,
        userId: "user-i4",
        sessionId: index < 2 ? "s1" : "s2",
        gameId: "debug-task-lab",
        evidenceId: `ev-i4-${index}`,
      });
      const result = await processEvidence({
        evidence,
        repository: learning,
        now: evidence.occurredAt,
      });
      stage = result.model.masteryStage;
    }
    expect(stage).not.toBe(MasteryStage.RECALLED);
    expect(stage).not.toBe(MasteryStage.USABLE);
    expect(stage).not.toBe(MasteryStage.MASTERED);
  });

  it("actor evidence never writes actress state", async () => {
    const actor = datasetLexeme("lex-0019-1");
    const actress = datasetLexeme("lex-0019-2");
    const generated = await generator.generate({
      need: makeNeed({
        lexemeId: actor.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: T0,
      createId: sequentialIdFactory("actor"),
      random: new SeededRandomSource("actor"),
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
        occurredAt: T0,
      },
    );
    const evidence = createLearningEvidenceFromTaskEvaluation({
      task: generated.value.publicTask,
      answerKey: generated.value.answerKey,
      evaluation,
      userId: "user-actor",
      sessionId: "s1",
      gameId: "debug-task-lab",
      evidenceId: "ev-actor",
    });
    expect(evidence.lexemeId).toBe(actor.id);
    expect(evidence.lexemeId).not.toBe(actress.id);
    const learning = new InMemoryLearningRepository();
    await processEvidence({
      evidence,
      repository: learning,
      now: T0,
    });
    expect(
      await learning.getStudentLexemeModel("user-actor", actress.id),
    ).toBeNull();
  });
});

function datasetLexeme(canonicalKey: string) {
  const lexeme = loadVocabularyDataset().lexemes.find(
    (item) => item.canonicalKey === canonicalKey,
  );
  if (!lexeme) {
    throw new Error(canonicalKey);
  }
  return lexeme;
}
