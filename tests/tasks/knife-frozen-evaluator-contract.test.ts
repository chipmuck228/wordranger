import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { DefaultTaskEvaluator } from "@/domain/tasks/default-task-evaluator";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { sequentialIdFactory } from "../learning/helpers";
import { makeNeed } from "./helpers";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";

const NOW = "2026-09-22T09:00:00.000Z";
const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
const generator = new DefaultTaskGenerator(vocabulary);
const evaluator = new DefaultTaskEvaluator();

describe("frozen ACTIVE_RECALL_TYPING contract for lex-0747-1", () => {
  it("accepts only the stored lemma, not a cleaned answer form", async () => {
    const [knife] = await vocabulary.findLexemeByLemma("knife(pl.knives)");
    expect(knife).toBeDefined();
    expect(knife.id).toBeDefined();
    expect(knife.lemma).toBe("knife(pl.knives)");
    expect(knife.display).toBe("knife(pl.knives)");
    expect(knife.variants).toEqual([]);
    expect(knife.forms).toEqual([]);
    expect(knife.meaningsZh).toEqual(["小刀", "匕首", "刀片"]);
    expect(knife.partsOfSpeech).toEqual(["noun"]);
    expect(knife.ipa).toEqual(["/naɪf/"]);
    expect(knife.abbreviationOfLexemeId).toBeNull();
    expect(knife.role).toBe("primary");
    expect(knife.quality.status).toBe("normalized");

    const dataset = JSON.parse(
      readFileSync("data/vocabulary/canonical/words-canonical.json", "utf8"),
    ) as {
      lexemes: Array<{
        id: string;
        variants: unknown[];
        forms: unknown[];
        meaningsZh: string[];
        source: { wordRaw: string; meaningRaw: string };
        quality: { status: string };
      }>;
    };
    const stored = dataset.lexemes.find((item) => item.id === "lex-0747-1");
    expect(stored).toMatchObject({
      variants: [],
      forms: [],
      meaningsZh: ["小刀", "匕首", "刀片"],
      source: {
        wordRaw: "knife（pl.knives）",
        meaningRaw: "小刀；匕首；刀片",
      },
      quality: { status: "normalized" },
    });

    const generated = await generator.generate({
      need: makeNeed({
        lexemeId: knife.id,
        targetSkill: VocabularySkill.ACTIVE_RECALL,
      }),
      desiredDifficulty: 0.4,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("knife-eval"),
      random: new SeededRandomSource("knife-eval"),
    });
    if (generated.status !== "GENERATED") {
      throw new Error(generated.reason);
    }
    expect(generated.value.answerKey.exactAcceptedTexts).toEqual(["knife(pl.knives)"]);

    const outcomes = ["knife", "knife(pl.knives)", "knives"].map((value) => ({
      value,
      outcome: evaluator.evaluate(generated.value.publicTask, generated.value.answerKey, {
        kind: "TEXT_INPUT",
        taskId: generated.value.publicTask.id,
        value,
        hintCount: 0,
        responseTimeMs: 800,
        occurredAt: NOW,
      }).outcome,
    }));

    expect(outcomes).toEqual([
      { value: "knife", outcome: EvidenceOutcome.INCORRECT },
      { value: "knife(pl.knives)", outcome: EvidenceOutcome.INDEPENDENT_CORRECT },
      { value: "knives", outcome: EvidenceOutcome.INCORRECT },
    ]);
  });
});
