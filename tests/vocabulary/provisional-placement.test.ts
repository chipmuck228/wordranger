import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialStudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import {
  ADAPTIVE_PLACEMENT_READINESS,
  assessAdaptivePlacementReadiness,
} from "@/domain/vocabulary/adaptive-placement-readiness";
import {
  buildProvisionalWordPlacementFile,
  generateProvisionalAssignments,
  serializeProvisionalWordPlacementFile,
  summarizeProvisionalPlacement,
} from "@/domain/vocabulary/generate-provisional-placement";
import { placementField } from "@/domain/vocabulary/placement-metadata";
import {
  orderedPlacementBands,
  PROVISIONAL_BAND_STRATEGY_ID,
  PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
  type PlacementBandDefinition,
} from "@/domain/vocabulary/provisional-placement";
import { provisionalPlacementIssues } from "@/domain/vocabulary/validate-provisional-placement";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { createInMemoryDailyTrainingRuntime } from "@/server/runtime/create-in-memory-daily-training-runtime";
import { FileVocabularyPlacementProvider } from "@/server/vocabulary/file-vocabulary-placement-provider";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { sequentialIdFactory, makeEvidence } from "../learning/helpers";
import { CountingVocabularyRepository } from "../scheduler/counting-vocabulary-repository";

const dataset = loadVocabularyDataset();
const repository = new InMemoryVocabularyRepository(dataset);
const definition = JSON.parse(
  readFileSync(
    join(process.cwd(), "data/vocabulary/placement/provisional-band-definition.json"),
    "utf8",
  ),
) as PlacementBandDefinition;
const committedFile = JSON.parse(
  readFileSync(
    join(process.cwd(), "data/vocabulary/placement/provisional-word-placement.json"),
    "utf8",
  ),
);
const identities = dataset.lexemes.map((lexeme) => ({
  id: lexeme.id,
  canonicalKey: lexeme.canonicalKey,
  sourceIndex: lexeme.sourceIndex,
}));
const lexemeIds = new Set(identities.map((lexeme) => lexeme.id));
const canonicalKeys = new Set(identities.map((lexeme) => lexeme.canonicalKey));

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

describe("Provisional vocabulary band generator", () => {
  it("B1: every canonical lexeme has exactly one provisional band assignment", () => {
    const records = generateProvisionalAssignments(definition, identities);
    expect(records).toHaveLength(dataset.lexemes.length);
    expect(new Set(records.map((record) => record.lexemeId)).size).toBe(
      dataset.lexemes.length,
    );
    for (const lexeme of dataset.lexemes) {
      expect(
        records.filter((record) => record.lexemeId === lexeme.id),
      ).toHaveLength(1);
    }
  });

  it("B2: no unknown lexemeId exists in generated or committed records", () => {
    const generated = generateProvisionalAssignments(definition, identities);
    const issues = provisionalPlacementIssues({
      definition,
      records: generated,
      lexemeIds,
      canonicalKeys,
    });
    expect(issues.filter((issue) => issue.code === "PROVISIONAL_UNKNOWN_LEXEME")).toEqual(
      [],
    );
    const committedIssues = provisionalPlacementIssues({
      definition,
      records: committedFile.records,
      lexemeIds,
      canonicalKeys,
    });
    expect(
      committedIssues.filter((issue) => issue.code === "PROVISIONAL_UNKNOWN_LEXEME"),
    ).toEqual([]);
  });

  it("B3: band definition has explicit unique ordering independent of ID sort", () => {
    const orders = definition.bands.map((band) => band.order);
    expect(new Set(orders).size).toBe(definition.bands.length);
    expect(orders).toEqual([10, 20, 30, 40, 50, 60]);
    const reversedIds: PlacementBandDefinition = {
      version: "provisional-v1",
      bands: [
        { id: "BAND_Z", order: 10 },
        { id: "BAND_A", order: 20 },
      ],
    };
    expect(orderedPlacementBands(reversedIds).map((band) => band.id)).toEqual([
      "BAND_Z",
      "BAND_A",
    ]);
    const duplicateOrder = provisionalPlacementIssues({
      definition: {
        version: "provisional-v1",
        bands: [
          { id: "BAND_1", order: 10 },
          { id: "BAND_2", order: 10 },
        ],
      },
      records: [],
      lexemeIds: new Set(),
    });
    expect(
      duplicateOrder.some((issue) => issue.code === "PROVISIONAL_BAND_DUPLICATE_ORDER"),
    ).toBe(true);
    const missingOrder = provisionalPlacementIssues({
      definition: {
        version: "provisional-v1",
        bands: [{ id: "BAND_1", order: Number.NaN }],
      },
      records: [],
      lexemeIds: new Set(),
    });
    expect(
      missingOrder.some((issue) => issue.code === "PROVISIONAL_BAND_MISSING_ORDER"),
    ).toBe(true);
  });

  it("B4/B5: the same generator version is deterministic and byte-equivalent", () => {
    const first = buildProvisionalWordPlacementFile(definition, identities);
    const second = buildProvisionalWordPlacementFile(definition, identities);
    expect(first.meta.generatorVersion).toBe(
      PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
    );
    expect(serializeProvisionalWordPlacementFile(first)).toBe(
      serializeProvisionalWordPlacementFile(second),
    );
    expect(serializeProvisionalWordPlacementFile(first)).toBe(
      readFileSync(
        join(
          process.cwd(),
          "data/vocabulary/placement/provisional-word-placement.json",
        ),
        "utf8",
      ),
    );
    const shuffled = [...identities].reverse();
    const fromShuffled = buildProvisionalWordPlacementFile(definition, shuffled);
    expect(serializeProvisionalWordPlacementFile(fromShuffled)).toBe(
      serializeProvisionalWordPlacementFile(first),
    );
  });

  it("B6/B7: generated records are INFERRED provisional provenance, never CURATED/EXTERNAL_REFERENCE", () => {
    const records = generateProvisionalAssignments(definition, identities);
    for (const record of records) {
      expect(record.provisionalBand.source).toBe("INFERRED");
      expect(record.provisionalBand.provenance).toEqual([
        PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
        PROVISIONAL_BAND_STRATEGY_ID,
      ]);
      expect(record.provisionalBand.source).not.toBe("CURATED");
      expect(record.provisionalBand.source).not.toBe("EXTERNAL_REFERENCE");
      expect(record.provisionalBand.source).not.toBe("SOURCE");
    }
    const curated = provisionalPlacementIssues({
      definition,
      records: [
        {
          lexemeId: dataset.lexemes[0].id,
          provisionalBand: placementField("BAND_1", "CURATED", [
            "must-not-unlock-production",
          ]),
        },
      ],
      lexemeIds,
      canonicalKeys,
    });
    expect(
      curated.some((issue) => issue.code === "PROVISIONAL_AUTHORITATIVE_SOURCE"),
    ).toBe(true);
    const emptyProvenance = provisionalPlacementIssues({
      definition,
      records: [
        {
          lexemeId: dataset.lexemes[0].id,
          provisionalBand: {
            value: "BAND_1",
            source: "INFERRED",
            provenance: [],
          },
        },
      ],
      lexemeIds,
      canonicalKeys,
    });
    expect(
      emptyProvenance.some((issue) => issue.code === "PROVISIONAL_MISSING_PROVENANCE"),
    ).toBe(true);
    const unknownBand = provisionalPlacementIssues({
      definition,
      records: [
        {
          lexemeId: dataset.lexemes[0].id,
          provisionalBand: placementField("GRADE_7", "INFERRED", [
            PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
          ]),
        },
      ],
      lexemeIds,
      canonicalKeys,
    });
    expect(
      unknownBand.some((issue) => issue.code === "PROVISIONAL_UNKNOWN_BAND"),
    ).toBe(true);
  });

  it("B8: StudentLexemeModel and LearningEvidence schemas remain unchanged", () => {
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
      expect(source).not.toMatch(/provisionalBand/);
      expect(source).not.toMatch(/BAND_1/);
      expect(source).not.toMatch(/curriculumBand/);
    }
  });

  it("B9: Scheduler v2 behavior is unchanged and does not read provisional bands", async () => {
    const counted = new CountingVocabularyRepository(repository);
    const plan = await planLearningSession({
      userId: "provisional-scheduler-user",
      now: "2026-09-17T12:00:00.000Z",
      requestedNeedCount: 8,
      createId: sequentialIdFactory("prv"),
      random: new SeededRandomSource("provisional"),
      vocabulary: counted,
      query: new InMemoryLearningStateQueryRepository(),
    });
    expect(counted.calls.listPlacementMetadata).toBe(0);
    expect(plan.needs.every((need) => need.reason === "NEW_WORD")).toBe(true);
    const scheduler = readFileSync(
      join(process.cwd(), "src/server/scheduler/plan-learning-session.ts"),
      "utf8",
    );
    expect(scheduler).not.toMatch(/provisional/i);
    expect(scheduler).not.toMatch(/listProvisionalPlacements/);
  });

  it("B10: Daily Training does not consume provisional bands in production mode", async () => {
    const counted = new CountingVocabularyRepository(repository);
    const runtime = createInMemoryDailyTrainingRuntime({
      userId: "provisional-training-user",
      vocabulary: counted,
      now: () => "2026-09-17T12:00:00.000Z",
      createSessionId: sequentialIdFactory("prvsess"),
      createId: sequentialIdFactory("prvtid"),
      createEvidenceId: sequentialIdFactory("prvev"),
      requestedNeedCount: 8,
    });
    const started = await runtime.createController().start();
    expect(counted.calls.listPlacementMetadata).toBe(0);
    const payload = JSON.stringify(started);
    expect(payload).not.toMatch(/provisionalBand/);
    expect(started.task).not.toHaveProperty("provisionalBand");
    expect(started.task).not.toHaveProperty("curriculumBand");
    const controller = readFileSync(
      join(process.cwd(), "src/server/training/daily-training-controller.ts"),
      "utf8",
    );
    const actions = readFileSync(
      join(process.cwd(), "src/app/train/actions.ts"),
      "utf8",
    );
    expect(controller).not.toMatch(/provisional/i);
    expect(actions).not.toMatch(/provisional/i);
    expect(actions).not.toMatch(/listProvisionalPlacements/);
  });

  it("B11: production assessAdaptivePlacementReadiness remains PLACEMENT_DATA_BLOCKER", async () => {
    const listed = await repository.listPlacementMetadata();
    const readiness = assessAdaptivePlacementReadiness(
      listed,
      dataset.lexemes.length,
    );
    expect(readiness.status).toBe(
      ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER,
    );
    expect(listed.some((record) => record.curriculumBand)).toBe(false);
    expect(listed.some((record) => record.difficultyBand)).toBe(false);
    expect(listed.some((record) => "provisionalBand" in record)).toBe(false);

    const asIfCurriculum = generateProvisionalAssignments(
      definition,
      identities,
    ).map((record) => ({
      lexemeId: record.lexemeId,
      curriculumBand: record.provisionalBand,
    }));
    expect(
      assessAdaptivePlacementReadiness(asIfCurriculum, dataset.lexemes.length)
        .status,
    ).toBe(ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER);
  });

  it("B12: band counts are non-empty and reasonably distributed", () => {
    const records = generateProvisionalAssignments(definition, identities);
    const qa = summarizeProvisionalPlacement(definition, records, lexemeIds);
    expect(qa.totalCanonicalLexemes).toBe(dataset.lexemes.length);
    expect(qa.assignedLexemes).toBe(dataset.lexemes.length);
    expect(qa.coverage).toBe(1);
    expect(qa.missingLexemeIds).toEqual([]);
    expect(qa.unknownLexemeIds).toEqual([]);
    expect(qa.duplicateLexemeIds).toEqual([]);
    const counts = Object.values(qa.bandCounts);
    expect(counts.length).toBe(6);
    expect(counts.every((count) => count > 0)).toBe(true);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    expect(max - min).toBeLessThanOrEqual(1);
  });

  it("validation rejects missing assignments, unknown UUIDs, and canonicalKey as lexemeId", () => {
    const one = dataset.lexemes[0].id;
    const missing = provisionalPlacementIssues({
      definition,
      records: [],
      lexemeIds: new Set([one]),
      canonicalKeys,
    });
    expect(missing.some((issue) => issue.code === "PROVISIONAL_MISSING_LEXEME")).toBe(
      true,
    );
    const unknown = provisionalPlacementIssues({
      definition,
      records: [
        {
          lexemeId: "00000000-0000-5000-8000-000000000000",
          provisionalBand: placementField("BAND_1", "INFERRED", [
            PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
          ]),
        },
      ],
      lexemeIds,
      canonicalKeys,
    });
    expect(unknown.some((issue) => issue.code === "PROVISIONAL_UNKNOWN_LEXEME")).toBe(
      true,
    );
    const asCanonicalKey = provisionalPlacementIssues({
      definition,
      records: [
        {
          lexemeId: dataset.lexemes[0].canonicalKey,
          provisionalBand: placementField("BAND_1", "INFERRED", [
            PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
          ]),
        },
      ],
      lexemeIds,
      canonicalKeys,
    });
    expect(
      asCanonicalKey.some(
        (issue) => issue.code === "PROVISIONAL_CANONICAL_KEY_AS_LEXEME_ID",
      ),
    ).toBe(true);
  });

  it("provider reads Lexeme.id records without dual-identity mapping", async () => {
    const provider = new FileVocabularyPlacementProvider(dataset);
    const listed = await provider.listProvisionalPlacements();
    expect(listed).toHaveLength(dataset.lexemes.length);
    const ids = new Set(listed.map((record) => record.lexemeId));
    expect(ids.size).toBe(dataset.lexemes.length);
    for (const lexeme of dataset.lexemes) {
      expect(ids.has(lexeme.id)).toBe(true);
      expect(ids.has(lexeme.canonicalKey)).toBe(false);
    }
    const production = await repository.listPlacementMetadata();
    expect(production.some((record) => "provisionalBand" in record)).toBe(false);
    const qa = await provider.summarizeProvisionalPlacement();
    expect(qa.coverage).toBe(1);
    expect(qa.missingLexemeIds).toEqual([]);
    expect(qa.unknownLexemeIds).toEqual([]);
  });

  it("I1: every provisional record lexemeId equals an existing Lexeme.id", () => {
    const records = generateProvisionalAssignments(definition, identities);
    const idSet = new Set(dataset.lexemes.map((lexeme) => lexeme.id));
    for (const record of [...records, ...committedFile.records]) {
      expect(idSet.has(record.lexemeId)).toBe(true);
      expect(record.lexemeId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    }
  });

  it("I2: no provisional record uses canonicalKey as lexemeId", () => {
    const keys = new Set(dataset.lexemes.map((lexeme) => lexeme.canonicalKey));
    for (const record of [
      ...generateProvisionalAssignments(definition, identities),
      ...committedFile.records,
    ]) {
      expect(keys.has(record.lexemeId)).toBe(false);
      expect(record.lexemeId).not.toMatch(/^lex-\d+/);
    }
  });

  it("I3: actor / actress split lexemes each have distinct UUID placements", () => {
    const actor = dataset.lexemes.find((item) => item.canonicalKey === "lex-0019-1");
    const actress = dataset.lexemes.find((item) => item.canonicalKey === "lex-0019-2");
    expect(actor && actress).toBeTruthy();
    expect(actor!.id).not.toBe(actress!.id);
    expect(actor!.canonicalKey).not.toBe(actress!.id);
    const records = generateProvisionalAssignments(definition, identities);
    const actorRow = records.find((record) => record.lexemeId === actor!.id);
    const actressRow = records.find((record) => record.lexemeId === actress!.id);
    expect(actorRow).toBeTruthy();
    expect(actressRow).toBeTruthy();
    expect(actorRow?.lexemeId).not.toBe(actressRow?.lexemeId);
    expect(records.some((record) => record.lexemeId === actor!.canonicalKey)).toBe(
      false,
    );
  });

  it("I4/I5: coverage remains 1638/1638 and band counts remain 273 each", () => {
    const qa = summarizeProvisionalPlacement(
      definition,
      generateProvisionalAssignments(definition, identities),
      lexemeIds,
    );
    expect(qa.totalCanonicalLexemes).toBe(1638);
    expect(qa.assignedLexemes).toBe(1638);
    expect(qa.coverage).toBe(1);
    expect(qa.bandCounts).toEqual({
      BAND_1: 273,
      BAND_2: 273,
      BAND_3: 273,
      BAND_4: 273,
      BAND_5: 273,
      BAND_6: 273,
    });
  });

  it("I6: two generations remain deterministic", () => {
    const first = serializeProvisionalWordPlacementFile(
      buildProvisionalWordPlacementFile(definition, identities),
    );
    const second = serializeProvisionalWordPlacementFile(
      buildProvisionalWordPlacementFile(definition, identities),
    );
    expect(first).toBe(second);
  });

  it("I7: production Adaptive Placement still returns PLACEMENT_DATA_BLOCKER", async () => {
    const listed = await repository.listPlacementMetadata();
    expect(
      assessAdaptivePlacementReadiness(listed, dataset.lexemes.length).status,
    ).toBe(ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER);
  });

  it("I8: Scheduler and Daily Training remain unchanged", async () => {
    const counted = new CountingVocabularyRepository(repository);
    await planLearningSession({
      userId: "identity-scheduler-user",
      now: "2026-09-17T12:00:00.000Z",
      requestedNeedCount: 8,
      createId: sequentialIdFactory("idsch"),
      random: new SeededRandomSource("identity"),
      vocabulary: counted,
      query: new InMemoryLearningStateQueryRepository(),
    });
    expect(counted.calls.listPlacementMetadata).toBe(0);
    const trainingCounted = new CountingVocabularyRepository(repository);
    await createInMemoryDailyTrainingRuntime({
      userId: "identity-training-user",
      vocabulary: trainingCounted,
      now: () => "2026-09-17T12:00:00.000Z",
      createSessionId: sequentialIdFactory("idsess"),
      createId: sequentialIdFactory("idtid"),
      createEvidenceId: sequentialIdFactory("idev"),
      requestedNeedCount: 8,
    })
      .createController()
      .start();
    expect(trainingCounted.calls.listPlacementMetadata).toBe(0);
  });
});
