import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialStudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import { buildPlacementMetadata } from "@/domain/vocabulary/derive-placement-metadata";
import {
  classifyFunctionWord,
  FUNCTION_WORD_POS_RULE_ID,
} from "@/domain/vocabulary/placement-metadata";
import { placementMetadataIssues } from "@/domain/vocabulary/validate-placement-metadata";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { createInMemoryDailyTrainingRuntime } from "@/server/runtime/create-in-memory-daily-training-runtime";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { validateVocabularyDataset } from "@/server/vocabulary/qa";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { sequentialIdFactory, makeEvidence } from "../learning/helpers";
import { CountingVocabularyRepository } from "../scheduler/counting-vocabulary-repository";

const dataset = loadVocabularyDataset();
const repository = new InMemoryVocabularyRepository(dataset);

const FROZEN_STUDENT_LEXEME_MODEL_KEYS = [
  "createdAt",
  "distinctPracticeDays",
  "distinctTaskTypes",
  "evidenceCount",
  "firstSeenAt",
  "id",
  "lastFailureAt",
  "lastSeenAt",
  "lastSuccessAt",
  "lexemeId",
  "masteryConfidence",
  "masteryScore",
  "masteryStage",
  "nextReviewAt",
  "policyVersion",
  "retentionState",
  "reviewIntervalDays",
  "skills",
  "updatedAt",
  "userId",
  "weaknesses",
].sort();

const FROZEN_LEARNING_EVIDENCE_KEYS = [
  "answerMode",
  "difficulty",
  "distractorLexemeIds",
  "errorType",
  "expectedAnswer",
  "gameId",
  "hintCount",
  "id",
  "lexemeId",
  "metadata",
  "occurredAt",
  "outcome",
  "promptMode",
  "responseTimeMs",
  "selectedLexemeId",
  "sessionId",
  "skill",
  "taskId",
  "taskType",
  "typedAnswer",
  "userId",
].sort();

describe("Vocabulary placement metadata", () => {
  it("M1: sourceIndex is not exposed or labeled as difficulty", async () => {
    const listed = await repository.listPlacementMetadata();
    expect(listed.length).toBe(dataset.lexemes.length);
    for (const record of listed) {
      expect(record).not.toHaveProperty("sourceIndex");
      expect(record.difficultyBand).toBeUndefined();
      expect(record).not.toHaveProperty("difficulty");
    }
    const lexeme = dataset.lexemes.find((item) => item.canonicalKey === "lex-0002-1");
    expect(lexeme?.sourceIndex).toBe(2);
    expect(lexeme?.lemma).toBe("ability");
    const metadata = listed.find((item) => item.lexemeId === lexeme?.id);
    expect(metadata?.difficultyBand).toBeUndefined();
    expect(metadata?.coreFoundation?.value).toBe(false);
    const comment = readFileSync(
      join(process.cwd(), "src/domain/vocabulary/lexeme.ts"),
      "utf8",
    );
    expect(comment).toMatch(/Not difficulty, grade, CEFR, frequency, or mastery/);
  });

  it("M2: placement metadata is linked by lexemeId, not source entry", async () => {
    const actor = dataset.lexemes.find((item) => item.canonicalKey === "lex-0019-1");
    const actress = dataset.lexemes.find((item) => item.canonicalKey === "lex-0019-2");
    expect(actor && actress).toBeTruthy();
    expect(actor?.sourceEntryId).toBe(actress?.sourceEntryId);
    const listed = await repository.listPlacementMetadata();
    const actorMeta = listed.find((item) => item.lexemeId === actor!.id);
    const actressMeta = listed.find((item) => item.lexemeId === actress!.id);
    expect(actorMeta).toBeTruthy();
    expect(actressMeta).toBeTruthy();
    expect(actorMeta?.lexemeId).not.toBe(actressMeta?.lexemeId);
    expect(actorMeta).not.toHaveProperty("sourceEntryId");
    expect(JSON.stringify(actorMeta)).not.toContain(actor!.sourceEntryId);
  });

  it("M3: metadata provenance is required", async () => {
    const listed = await repository.listPlacementMetadata();
    for (const record of listed) {
      expect(record.coreFoundation?.provenance.length).toBeGreaterThan(0);
      expect(record.coreFoundation?.source).toBe("SOURCE");
      if (record.alphabeticalSection) {
        expect(record.alphabeticalSection.provenance.length).toBeGreaterThan(0);
        expect(record.alphabeticalSection.source).toBe("SOURCE");
      }
      if (record.functionWord) {
        expect(record.functionWord.provenance.length).toBeGreaterThan(0);
      }
    }
    const missing = placementMetadataIssues(
      [
        {
          lexemeId: dataset.lexemes[0].id,
          coreFoundation: {
            value: true,
            source: "SOURCE",
            provenance: [],
          },
        },
      ],
      new Set(dataset.lexemes.map((lexeme) => lexeme.id)),
    );
    expect(missing.some((issue) => issue.code === "PLACEMENT_MISSING_PROVENANCE")).toBe(
      true,
    );
  });

  it("M4: unknown fields remain absent rather than guessed", async () => {
    const listed = await repository.listPlacementMetadata();
    const emptyPos = dataset.lexemes.filter(
      (lexeme) => lexeme.partsOfSpeech.length === 0,
    );
    expect(emptyPos.length).toBeGreaterThan(0);
    for (const lexeme of emptyPos) {
      const record = listed.find((item) => item.lexemeId === lexeme.id);
      expect(record?.functionWord).toBeUndefined();
    }
    const adverbOnly = dataset.lexemes.find(
      (lexeme) =>
        lexeme.partsOfSpeech.length > 0 &&
        lexeme.partsOfSpeech.every((pos) => pos === "adverb"),
    );
    expect(adverbOnly).toBeTruthy();
    expect(
      listed.find((item) => item.lexemeId === adverbOnly!.id)?.functionWord,
    ).toBeUndefined();
    for (const record of listed) {
      expect(record.curriculumBand).toBeUndefined();
      expect(record.gradeBand).toBeUndefined();
      expect(record.frequencyBand).toBeUndefined();
      expect(record.difficultyBand).toBeUndefined();
    }
  });

  it("M5: inferred metadata is distinguishable from source-backed metadata", async () => {
    const listed = await repository.listPlacementMetadata();
    const article = dataset.lexemes.find((item) => item.canonicalKey === "lex-0001-1");
    const articleMeta = listed.find((item) => item.lexemeId === article?.id);
    expect(article?.partsOfSpeech).toEqual(["article"]);
    expect(articleMeta?.functionWord).toEqual({
      value: true,
      source: "INFERRED",
      provenance: ["canonical.partsOfSpeech", FUNCTION_WORD_POS_RULE_ID],
      confidence: 0.8,
    });
    expect(articleMeta?.coreFoundation).toEqual({
      value: true,
      source: "SOURCE",
      provenance: ["pdf.starred"],
    });
    expect(articleMeta?.functionWord?.source).not.toBe(articleMeta?.coreFoundation?.source);
    expect(classifyFunctionWord(["noun"])).toBe(false);
    expect(classifyFunctionWord(["adverb"])).toBeNull();
  });

  it("M6: VocabularyRepository bulk-loads placement metadata without N+1", async () => {
    const counted = new CountingVocabularyRepository(repository);
    const listed = await counted.listPlacementMetadata();
    expect(counted.calls.listPlacementMetadata).toBe(1);
    expect(counted.calls.getLexeme).toBe(0);
    expect(counted.calls.getLexemes).toBe(0);
    expect(counted.calls.getTags).toBe(0);
    expect(listed).toHaveLength(dataset.lexemes.length);
    const again = await counted.listPlacementMetadata();
    expect(counted.calls.listPlacementMetadata).toBe(2);
    expect(again).toHaveLength(listed.length);
  });

  it("M7: StudentLexemeModel and LearningEvidence schemas remain unchanged", () => {
    const model = createInitialStudentLexemeModel({
      id: "model-1",
      userId: "user-1",
      lexemeId: "lexeme-1",
      now: "2026-09-17T00:00:00.000Z",
      policyVersion: "v1",
    });
    expect(Object.keys(model).sort()).toEqual(FROZEN_STUDENT_LEXEME_MODEL_KEYS);
    const evidence = makeEvidence("ev-1", "s1", "2026-09-17T00:00:00.000Z");
    expect(Object.keys(evidence).sort()).toEqual(FROZEN_LEARNING_EVIDENCE_KEYS);
    const modelSource = readFileSync(
      join(process.cwd(), "src/domain/learning/student-lexeme-model.ts"),
      "utf8",
    );
    const evidenceSource = readFileSync(
      join(process.cwd(), "src/domain/learning/evidence.types.ts"),
      "utf8",
    );
    for (const source of [modelSource, evidenceSource]) {
      expect(source).not.toMatch(/functionWord/);
      expect(source).not.toMatch(/curriculumBand/);
      expect(source).not.toMatch(/gradeBand/);
      expect(source).not.toMatch(/frequencyBand/);
      expect(source).not.toMatch(/listPlacementMetadata/);
    }
  });

  it("M8: Scheduler v2 does not read placement metadata", async () => {
    const counted = new CountingVocabularyRepository(repository);
    await planLearningSession({
      userId: "placement-scheduler-user",
      now: "2026-09-17T12:00:00.000Z",
      requestedNeedCount: 8,
      createId: sequentialIdFactory("plc"),
      random: new SeededRandomSource("placement"),
      vocabulary: counted,
      query: new InMemoryLearningStateQueryRepository(),
    });
    expect(counted.calls.listPlacementMetadata).toBe(0);
    expect(counted.calls.listLexemes).toBe(1);
    expect(counted.calls.listRelations).toBe(1);
  });

  it("M9: Daily Training does not query placement metadata", async () => {
    const counted = new CountingVocabularyRepository(repository);
    const runtime = createInMemoryDailyTrainingRuntime({
      userId: "placement-training-user",
      vocabulary: counted,
      now: () => "2026-09-17T12:00:00.000Z",
      createSessionId: sequentialIdFactory("psess"),
      createId: sequentialIdFactory("ptid"),
      createEvidenceId: sequentialIdFactory("pev"),
      requestedNeedCount: 8,
    });
    await runtime.createController().start();
    expect(counted.calls.listPlacementMetadata).toBe(0);
  });

  it("M10: validation rejects metadata pointing to unknown lexemeIds", () => {
    const known = new Set(dataset.lexemes.map((lexeme) => lexeme.id));
    const issues = placementMetadataIssues(
      [
        {
          lexemeId: "does-not-exist",
          coreFoundation: {
            value: true,
            source: "SOURCE",
            provenance: ["pdf.starred"],
          },
        },
      ],
      known,
    );
    expect(issues.some((issue) => issue.code === "PLACEMENT_UNKNOWN_LEXEME")).toBe(
      true,
    );
  });

  it("bundled derivation does not mutate canonical lexeme fields", () => {
    const before = dataset.lexemes.map((lexeme) => ({ ...lexeme }));
    const built = buildPlacementMetadata(dataset.lexemes, dataset.sourceEntries);
    expect(dataset.lexemes).toEqual(before);
    expect(built).toHaveLength(dataset.lexemes.length);
    const qa = validateVocabularyDataset(dataset);
    expect(qa.issues.filter((issue) => issue.code.startsWith("PLACEMENT_"))).toEqual(
      [],
    );
  });

  it("rejects inferred difficulty bands and duplicate lexeme metadata", () => {
    const lexemeId = dataset.lexemes[0].id;
    const known = new Set([lexemeId]);
    const inferredBand = placementMetadataIssues(
      [
        {
          lexemeId,
          difficultyBand: {
            value: "easy",
            source: "INFERRED",
            provenance: ["llm"],
          },
        },
      ],
      known,
    );
    expect(inferredBand.some((issue) => issue.code === "PLACEMENT_INFERRED_BAND")).toBe(
      true,
    );
    const duplicates = placementMetadataIssues(
      [
        {
          lexemeId,
          coreFoundation: {
            value: false,
            source: "SOURCE",
            provenance: ["pdf.starred"],
          },
        },
        {
          lexemeId,
          coreFoundation: {
            value: true,
            source: "SOURCE",
            provenance: ["pdf.starred"],
          },
        },
      ],
      known,
    );
    expect(
      duplicates.some((issue) => issue.code === "PLACEMENT_DUPLICATE_LEXEME"),
    ).toBe(true);
    const badConfidence = placementMetadataIssues(
      [
        {
          lexemeId,
          functionWord: {
            value: true,
            source: "INFERRED",
            provenance: ["canonical.partsOfSpeech"],
            confidence: 1.4,
          },
        },
      ],
      known,
    );
    expect(
      badConfidence.some((issue) => issue.code === "PLACEMENT_CONFIDENCE_RANGE"),
    ).toBe(true);
  });
});
