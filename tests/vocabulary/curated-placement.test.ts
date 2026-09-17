import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialStudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import {
  ADAPTIVE_PLACEMENT_READINESS,
  assessAdaptivePlacementReadiness,
} from "@/domain/vocabulary/adaptive-placement-readiness";
import { buildServerCuratedOverride } from "@/domain/vocabulary/build-curated-override";
import {
  HUMAN_REVIEW_PROVENANCE,
  type CuratedPlacementOverride,
} from "@/domain/vocabulary/curated-placement";
import {
  mergeEffectivePlacements,
  summarizePlacementReview,
} from "@/domain/vocabulary/effective-placement";
import { curatedPlacementIssues } from "@/domain/vocabulary/validate-curated-placement";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { createInMemoryDailyTrainingRuntime } from "@/server/runtime/create-in-memory-daily-training-runtime";
import {
  FileCuratedPlacementStore,
  InMemoryCuratedPlacementStore,
} from "@/server/vocabulary/curated-placement-store";
import { FileVocabularyPlacementProvider } from "@/server/vocabulary/file-vocabulary-placement-provider";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { buildPlacementReviewSnapshot } from "@/server/vocabulary/placement-review-snapshot";
import { saveCuratedPlacementReview } from "@/server/vocabulary/save-curated-placement-review";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { sequentialIdFactory, makeEvidence } from "../learning/helpers";
import { CountingVocabularyRepository } from "../scheduler/counting-vocabulary-repository";

const dataset = loadVocabularyDataset();
const repository = new InMemoryVocabularyRepository(dataset);
const ability = dataset.lexemes.find((lexeme) => lexeme.canonicalKey === "lex-0002-1")!;
const actor = dataset.lexemes.find((lexeme) => lexeme.canonicalKey === "lex-0019-1")!;
const definition = {
  version: "provisional-v1",
  bands: [
    { id: "BAND_1", order: 10 },
    { id: "BAND_2", order: 20 },
    { id: "BAND_3", order: 30 },
    { id: "BAND_4", order: 40 },
    { id: "BAND_5", order: 50 },
    { id: "BAND_6", order: 60 },
  ],
};
const lexemeIds = new Set(dataset.lexemes.map((lexeme) => lexeme.id));
const canonicalKeys = new Set(dataset.lexemes.map((lexeme) => lexeme.canonicalKey));
const now = "2026-09-17T12:00:00.000Z";

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

function sampleOverride(
  overrides: Partial<CuratedPlacementOverride> = {},
): CuratedPlacementOverride {
  return {
    lexemeId: ability.id,
    bandId: "BAND_3",
    status: "REVIEWED",
    source: "CURATED",
    provenance: [HUMAN_REVIEW_PROVENANCE],
    reviewedAt: now,
    ...overrides,
  };
}

describe("Curated placement review", () => {
  it("C1: curated override is keyed by real Lexeme.id", async () => {
    const store = new InMemoryCuratedPlacementStore();
    const result = await saveCuratedPlacementReview({
      lexemeId: ability.id,
      bandId: "BAND_3",
      now,
      dataset,
      definition,
      store,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.lexemeId).toBe(ability.id);
      expect(result.record.lexemeId).not.toBe(ability.canonicalKey);
    }
  });

  it("C2: canonicalKey used as lexemeId is rejected", async () => {
    const result = await saveCuratedPlacementReview({
      lexemeId: ability.canonicalKey,
      bandId: "BAND_3",
      now,
      dataset,
      definition,
      store: new InMemoryCuratedPlacementStore(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CURATED_CANONICAL_KEY_AS_LEXEME_ID");
    }
  });

  it("C3: unknown band is rejected", async () => {
    const result = await saveCuratedPlacementReview({
      lexemeId: ability.id,
      bandId: "GRADE_7",
      now,
      dataset,
      definition,
      store: new InMemoryCuratedPlacementStore(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CURATED_UNKNOWN_BAND");
    }
  });

  it("C4/C5/C6: source, provenance, and reviewedAt are server-owned", () => {
    const record = buildServerCuratedOverride({
      lexemeId: ability.id,
      bandId: "BAND_2",
      reviewNote: "ok",
      now,
    });
    expect(record.source).toBe("CURATED");
    expect(record.provenance).toEqual([HUMAN_REVIEW_PROVENANCE]);
    expect(record.reviewedAt).toBe(now);
    expect(record.status).toBe("REVIEWED");
  });

  it("C7: accepting the provisional band still creates a reviewed CURATED record", async () => {
    const provider = new FileVocabularyPlacementProvider(
      dataset,
      definition,
      undefined,
      new InMemoryCuratedPlacementStore(),
    );
    const provisional = (await provider.listProvisionalPlacements()).find(
      (record) => record.lexemeId === ability.id,
    );
    expect(provisional).toBeTruthy();
    const store = new InMemoryCuratedPlacementStore();
    const result = await saveCuratedPlacementReview({
      lexemeId: ability.id,
      bandId: provisional!.provisionalBand.value,
      now,
      dataset,
      definition,
      store,
    });
    expect(result.ok).toBe(true);
    const curated = await store.list();
    expect(curated).toHaveLength(1);
    expect(curated[0]?.bandId).toBe(provisional!.provisionalBand.value);
    expect(curated[0]?.source).toBe("CURATED");
  });

  it("C8/C9: curated override replaces provisional in effective placement; missing override falls back", () => {
    const provisional = [
      {
        lexemeId: ability.id,
        provisionalBand: {
          value: "BAND_2",
          source: "INFERRED" as const,
          provenance: ["wordranger-provisional-band-generator/v1"],
        },
      },
      {
        lexemeId: actor.id,
        provisionalBand: {
          value: "BAND_4",
          source: "INFERRED" as const,
          provenance: ["wordranger-provisional-band-generator/v1"],
        },
      },
    ];
    const none = mergeEffectivePlacements(provisional, []);
    expect(none.find((row) => row.lexemeId === ability.id)).toMatchObject({
      bandId: "BAND_2",
      origin: "PROVISIONAL",
    });
    const merged = mergeEffectivePlacements(provisional, [
      sampleOverride({ bandId: "BAND_6" }),
    ]);
    expect(merged.find((row) => row.lexemeId === ability.id)).toMatchObject({
      bandId: "BAND_6",
      origin: "CURATED",
      provenance: [HUMAN_REVIEW_PROVENANCE],
    });
    expect(merged.find((row) => row.lexemeId === actor.id)).toMatchObject({
      bandId: "BAND_4",
      origin: "PROVISIONAL",
    });
  });

  it("C10: provisional artifact remains unchanged after review write", async () => {
    const provisionalPath = path.join(
      process.cwd(),
      "data/vocabulary/placement/provisional-word-placement.json",
    );
    const before = readFileSync(provisionalPath);
    const dir = mkdtempSync(path.join(tmpdir(), "curated-placement-"));
    const store = new FileCuratedPlacementStore(path.join(dir, "curated.json"));
    const result = await saveCuratedPlacementReview({
      lexemeId: ability.id,
      bandId: "BAND_5",
      now,
      dataset,
      definition,
      store,
    });
    expect(result.ok).toBe(true);
    expect(readFileSync(provisionalPath)).toEqual(before);
    rmSync(dir, { recursive: true, force: true });
  });

  it("C11: review coverage counts explicit curated records only", () => {
    const coverage = summarizePlacementReview({
      definition,
      totalLexemes: 4,
      provisionalCount: 4,
      lexemeIds: new Set([ability.id, actor.id, "c", "d"]),
      curated: [
        sampleOverride({ bandId: "BAND_2" }),
        sampleOverride({ lexemeId: actor.id, bandId: "BAND_2" }),
      ],
    });
    expect(coverage.reviewedCount).toBe(2);
    expect(coverage.unreviewedCount).toBe(2);
    expect(coverage.reviewedCoverage).toBe(0.5);
    expect(coverage.reviewedBandCounts.BAND_2).toBe(2);
  });

  it("C12: bulk list/read has no N+1 lexeme access", async () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/server/vocabulary/placement-review-snapshot.ts"),
      "utf8",
    );
    expect(source).toContain("dataset.lexemes.map");
    expect(source).not.toMatch(/getLexeme\(/);
    expect(source).not.toMatch(/getLexemes\(/);
    const snapshot = await buildPlacementReviewSnapshot(
      dataset,
      new FileVocabularyPlacementProvider(
        dataset,
        definition,
        undefined,
        new InMemoryCuratedPlacementStore(),
      ),
    );
    expect(snapshot.rows).toHaveLength(dataset.lexemes.length);
  });

  it("C13: Scheduler does not consume curated/provisional placement yet", async () => {
    const counted = new CountingVocabularyRepository(repository);
    await planLearningSession({
      userId: "curated-scheduler-user",
      now,
      requestedNeedCount: 8,
      createId: sequentialIdFactory("csch"),
      random: new SeededRandomSource("curated"),
      vocabulary: counted,
      query: new InMemoryLearningStateQueryRepository(),
    });
    expect(counted.calls.listPlacementMetadata).toBe(0);
    const scheduler = readFileSync(
      path.join(process.cwd(), "src/server/scheduler/plan-learning-session.ts"),
      "utf8",
    );
    expect(scheduler).not.toMatch(/listCuratedOverrides|listEffectivePlacements|provisionalBand/);
  });

  it("C14: Daily Training behavior is unchanged", async () => {
    const counted = new CountingVocabularyRepository(repository);
    const runtime = createInMemoryDailyTrainingRuntime({
      userId: "curated-training-user",
      vocabulary: counted,
      now: () => now,
      createSessionId: sequentialIdFactory("csess"),
      createId: sequentialIdFactory("ctid"),
      createEvidenceId: sequentialIdFactory("cev"),
      requestedNeedCount: 8,
    });
    await runtime.createController().start();
    expect(counted.calls.listPlacementMetadata).toBe(0);
  });

  it("C15: StudentLexemeModel / LearningEvidence schemas unchanged", () => {
    const model = createInitialStudentLexemeModel({
      id: "model-1",
      userId: "user-1",
      lexemeId: "lexeme-1",
      now,
      policyVersion: "v1",
    });
    expect(Object.keys(model).sort()).toEqual(FROZEN_STUDENT_LEXEME_MODEL_KEYS);
    const evidence = makeEvidence("ev-1", "s1", now);
    expect(Object.keys(evidence).sort()).toEqual(FROZEN_LEARNING_EVIDENCE_KEYS);
  });

  it("C16: student-facing PublicLearningTask contains no placement metadata", async () => {
    const started = await createInMemoryDailyTrainingRuntime({
      userId: "curated-payload-user",
      now: () => now,
      createSessionId: sequentialIdFactory("psess"),
      createId: sequentialIdFactory("ptid"),
      createEvidenceId: sequentialIdFactory("pev"),
      requestedNeedCount: 8,
    })
      .createController()
      .start();
    const payload = JSON.stringify(started.task);
    expect(payload).not.toMatch(/provisionalBand|curatedBand|effectiveBand|curriculumBand/);
    expect(started.task).not.toHaveProperty("provisionalBand");
    const trainActions = readFileSync(
      path.join(process.cwd(), "src/app/train/actions.ts"),
      "utf8",
    );
    expect(trainActions).not.toMatch(/listEffectivePlacements|listCuratedOverrides/);
  });

  it("validation rejects unknown lexeme, duplicate overrides, missing provenance, and bad reviewedAt", () => {
    expect(
      curatedPlacementIssues({
        definition,
        records: [sampleOverride({ lexemeId: "00000000-0000-5000-8000-000000000099" })],
        lexemeIds,
        canonicalKeys,
      }).some((issue) => issue.code === "CURATED_UNKNOWN_LEXEME"),
    ).toBe(true);
    expect(
      curatedPlacementIssues({
        definition,
        records: [sampleOverride(), sampleOverride({ bandId: "BAND_1" })],
        lexemeIds,
        canonicalKeys,
      }).some((issue) => issue.code === "CURATED_DUPLICATE_LEXEME"),
    ).toBe(true);
    expect(
      curatedPlacementIssues({
        definition,
        records: [sampleOverride({ provenance: [] })],
        lexemeIds,
        canonicalKeys,
      }).some((issue) => issue.code === "CURATED_MISSING_PROVENANCE"),
    ).toBe(true);
    expect(
      curatedPlacementIssues({
        definition,
        records: [sampleOverride({ reviewedAt: "yesterday" })],
        lexemeIds,
        canonicalKeys,
      }).some((issue) => issue.code === "CURATED_MALFORMED_REVIEWED_AT"),
    ).toBe(true);
  });

  it("production Adaptive Placement remains blocked after curated review writes", async () => {
    const listed = await repository.listPlacementMetadata();
    expect(
      assessAdaptivePlacementReadiness(listed, dataset.lexemes.length).status,
    ).toBe(ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER);
    expect(listed.some((record) => record.curriculumBand)).toBe(false);
  });

  it("file store upserts by lexemeId and can be reread", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "curated-file-"));
    const filePath = path.join(dir, "curated-word-placement.json");
    writeFileSync(filePath, `${JSON.stringify({ version: "curated-v1", records: [] }, null, 2)}\n`);
    const store = new FileCuratedPlacementStore(filePath);
    await store.upsert(sampleOverride({ bandId: "BAND_1" }));
    await store.upsert(sampleOverride({ bandId: "BAND_4", reviewNote: "changed" }));
    const listed = await store.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.bandId).toBe("BAND_4");
    expect(listed[0]?.reviewNote).toBe("changed");
    rmSync(dir, { recursive: true, force: true });
  });
});
