import { describe, expect, it } from "vitest";
import { PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { TaskUnavailableCode } from "@/domain/tasks/task-unavailable";
import { sequentialIdFactory } from "../learning/helpers";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { InMemoryVocabularyInspectionRepository } from "@/server/vocabulary/in-memory-vocabulary-inspection-repository";
import { readFileSync } from "node:fs";
import path from "node:path";
import { makeNeed, makeNeedWithConfusion, tinyDataset } from "./helpers";

const NOW = "2026-03-01T09:00:00.000Z";
const dataset = loadVocabularyDataset();
const vocabulary = new InMemoryVocabularyRepository(dataset);
const generator = new DefaultTaskGenerator(vocabulary);

async function generate(
  need: ReturnType<typeof makeNeed>,
  seed = "seed-a",
  createId = sequentialIdFactory("tid"),
) {
  return generator.generate({
    need,
    desiredDifficulty: 0.4,
    recentTasks: [],
    now: NOW,
    createId,
    random: new SeededRandomSource(seed),
  });
}

describe("Task Generator", () => {
  it("TEST T1: same input + seed produces the same task", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const need = makeNeed({
      lexemeId: quiet.id,
      targetSkill: VocabularySkill.MEANING_RECOGNITION,
    });
    const first = await generate(need, "stable", sequentialIdFactory("tid"));
    const second = await generate(need, "stable", sequentialIdFactory("tid"));
    expect(first.status).toBe("GENERATED");
    expect(second.status).toBe("GENERATED");
    if (first.status === "GENERATED" && second.status === "GENERATED") {
      expect(first.value.publicTask.prompt).toEqual(second.value.publicTask.prompt);
      expect(first.value.publicTask.responseContract).toEqual(
        second.value.publicTask.responseContract,
      );
      expect(first.value.answerKey.correctOptionIds.length).toBe(
        second.value.answerKey.correctOptionIds.length,
      );
    }
  });

  it("TEST T2: PublicLearningTask does not contain answerKey", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      expect(result.value.publicTask).not.toHaveProperty("answerKey");
      expect(JSON.stringify(result.value.publicTask)).not.toContain("correctOptionIds");
    }
  });

  it("TEST T3: public options do not include isCorrect", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (
      result.status === "GENERATED" &&
      result.value.publicTask.responseContract.kind === "CHOICE"
    ) {
      for (const option of result.value.publicTask.responseContract.options) {
        expect(option).not.toHaveProperty("isCorrect");
        expect(option).not.toHaveProperty("lexemeId");
      }
    }
  });

  it("TEST T4: MeaningChoice has exactly one correct option", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      expect(result.value.answerKey.correctOptionIds).toHaveLength(1);
    }
  });

  it("TEST T5: option texts are unique", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (
      result.status === "GENERATED" &&
      result.value.publicTask.responseContract.kind === "CHOICE"
    ) {
      const texts = result.value.publicTask.responseContract.options.map(
        (option) => option.content.text,
      );
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it("TEST T6: target meaning is not reused as a distractor", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (
      result.status === "GENERATED" &&
      result.value.publicTask.responseContract.kind === "CHOICE"
    ) {
      const correctId = result.value.answerKey.correctOptionIds[0];
      const correctText =
        result.value.publicTask.responseContract.options.find(
          (option) => option.id === correctId,
        )?.content.text;
      const distractorTexts =
        result.value.publicTask.responseContract.options
          .filter((option) => option.id !== correctId)
          .map((option) => option.content.text);
      expect(distractorTexts).not.toContain(correctText);
    }
  });

  it("TEST T7: rule_inferred relations are not used in tasks", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.SEMANTIC_CONNECTION,
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      const inspection = new InMemoryVocabularyInspectionRepository(vocabulary);
      const raw = await inspection.getRawRelations(quiet.id);
      const inferredIds = new Set(
        raw
          .filter((relation) => relation.provenance === "rule_inferred")
          .map((relation) => relation.id),
      );
      for (const relationId of result.value.generationTrace.relationIds) {
        expect(inferredIds.has(relationId)).toBe(false);
      }
    }
  });

  it("TEST T8: explicit rule_inferred filter cannot bypass production policy", async () => {
    const inferred = dataset.relations.find(
      (relation) => relation.provenance === "rule_inferred",
    )!;
    const production = await vocabulary.getRelations(inferred.fromLexemeId, {
      provenances: ["rule_inferred"],
    });
    expect(production).toEqual([]);
  });

  it("TEST T9: approved curated_model relations can be used", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const [quite] = await vocabulary.findLexemeByLemma("quite");
    const result = await generate(
      makeNeedWithConfusion(quiet.id, quite.id),
    );
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      expect(
        result.value.answerKey.confusionLexemeIds?.includes(quite.id),
      ).toBe(true);
    }
  });

  it("TEST T10: source_structural relations can be used", async () => {
    const structural = dataset.relations.find(
      (relation) => relation.provenance === "source_structural",
    )!;
    const result = await generate(
      makeNeed({
        lexemeId: structural.fromLexemeId,
        targetSkill: VocabularySkill.SEMANTIC_CONNECTION,
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      expect(result.value.generationTrace.relationIds.length).toBeGreaterThan(0);
    }
  });

  it("TEST T11: CONFUSION need prefers relatedLexemeId as a distractor", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const [quite] = await vocabulary.findLexemeByLemma("quite");
    const result = await generate(makeNeedWithConfusion(quiet.id, quite.id));
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      expect(
        result.value.generationTrace.selectedDistractorLexemeIds,
      ).toContain(quite.id);
    }
  });

  it("TEST T12: policy-blocked confusion related lexeme is not forced in", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const fakeRelated = "00000000-0000-4000-8000-000000000099";
    const result = await generate(
      makeNeedWithConfusion(quiet.id, fakeRelated),
    );
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      expect(
        result.value.generationTrace.selectedDistractorLexemeIds,
      ).not.toContain(fakeRelated);
      expect(
        result.value.generationTrace.blockedCandidates.some(
          (item) => item.lexemeId === fakeRelated,
        ),
      ).toBe(true);
    }
  });

  it("TEST T13: ACTIVE_RECALL uses typing", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.ACTIVE_RECALL,
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      expect(result.value.publicTask.taskType).toBe(
        LearningTaskType.ACTIVE_RECALL_TYPING,
      );
      expect(result.value.publicTask.answerMode).toBe("TYPING");
      expect(result.value.publicTask.responseContract.kind).toBe("TEXT_INPUT");
      expect(result.value.publicTask.promptMode).toBe(PromptMode.MEANING_TO_WORD);
    }
  });

  it("TEST T14: multiple choice cannot generate ACTIVE_RECALL evidence", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.ACTIVE_RECALL,
        preferredPromptModes: [PromptMode.WORD_TO_MEANING],
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      expect(result.value.publicTask.answerMode).not.toBe("MULTIPLE_CHOICE");
      expect(result.value.publicTask.targetSkill).toBe(
        VocabularySkill.ACTIVE_RECALL,
      );
    }
  });

  it("TEST T15: SPELLING_RECALL uses spelling/text production", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.SPELLING_RECALL,
      }),
    );
    expect(result.status).toBe("GENERATED");
    if (result.status === "GENERATED") {
      expect(result.value.publicTask.taskType).toBe(
        LearningTaskType.SPELLING_RECALL_TYPING,
      );
      expect(result.value.publicTask.answerMode).toBe("SPELLING");
      expect(result.value.publicTask.promptMode).toBe(
        PromptMode.MEANING_TO_SPELLING,
      );
    }
  });

  it("TEST T16: LISTENING returns MISSING_REQUIRED_CONTENT", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.LISTENING_RECOGNITION,
      }),
    );
    expect(result).toMatchObject({
      status: "UNAVAILABLE",
      code: TaskUnavailableCode.MISSING_REQUIRED_CONTENT,
    });
  });

  it("TEST T17: CONTEXT_USE returns MISSING_REQUIRED_CONTENT", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const result = await generate(
      makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.CONTEXT_USE,
      }),
    );
    expect(result).toMatchObject({
      status: "UNAVAILABLE",
      code: TaskUnavailableCode.MISSING_REQUIRED_CONTENT,
    });
  });

  it("TEST T18: a lexeme without meaning cannot generate a meaning task", async () => {
    const repo = new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: [{ id: "lex-empty", lemma: "empty", meaningsZh: [] }],
      }),
    );
    const local = new DefaultTaskGenerator(repo);
    const result = await local.generate({
      need: makeNeed({
        lexemeId: "lex-empty",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
      desiredDifficulty: 0.5,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("x"),
      random: new SeededRandomSource("s"),
    });
    expect(result).toMatchObject({
      status: "UNAVAILABLE",
      code: TaskUnavailableCode.MISSING_REQUIRED_CONTENT,
    });
  });

  it("TEST T19: too few distractors returns INSUFFICIENT_DISTRACTORS", async () => {
    const repo = new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: [
          {
            id: "lex-a",
            lemma: "alpha",
            meaningsZh: ["甲"],
            sourceEntryId: "s1",
          },
          {
            id: "lex-b",
            lemma: "beta",
            meaningsZh: ["乙"],
            sourceEntryId: "s2",
          },
        ],
      }),
    );
    const local = new DefaultTaskGenerator(repo);
    const result = await local.generate({
      need: makeNeed({
        lexemeId: "lex-a",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
      desiredDifficulty: 0.5,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("x"),
      random: new SeededRandomSource("s"),
    });
    expect(result).toMatchObject({
      status: "UNAVAILABLE",
      code: TaskUnavailableCode.INSUFFICIENT_DISTRACTORS,
    });
  });

  it("TEST T20: Task Generator source does not import the inspection repository", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/domain/tasks/default-task-generator.ts",
      ),
      "utf8",
    );
    expect(source).not.toContain("VocabularyInspectionRepository");
    expect(source).not.toContain("getRawRelations");
  });
});
