import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createInitialStudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import {
  ADAPTIVE_PLACEMENT_READINESS,
  assessAdaptivePlacementReadiness,
} from "@/domain/vocabulary/adaptive-placement-readiness";
import { HUMAN_REVIEW_PROVENANCE } from "@/domain/vocabulary/curated-placement";
import { mergeEffectivePlacements } from "@/domain/vocabulary/effective-placement";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { createInMemoryDailyTrainingRuntime } from "@/server/runtime/create-in-memory-daily-training-runtime";
import { createCuratedPlacementStore } from "@/server/vocabulary/create-curated-placement-store";
import { FileCuratedPlacementStore } from "@/server/vocabulary/curated-placement-store";
import { InMemoryCuratedPlacementStore } from "@/server/vocabulary/curated-placement-store";
import {
  mapVocabularyPlacementReviewRow,
  toVocabularyPlacementReviewRow,
} from "@/server/vocabulary/curated-placement-row";
import { FileVocabularyPlacementProvider } from "@/server/vocabulary/file-vocabulary-placement-provider";
import {
  applyCuratedPlacementImport,
  planCuratedPlacementImport,
  serializeCuratedPlacementExport,
} from "@/server/vocabulary/import-curated-placement";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import {
  CuratedPlacementConfigError,
  describePlacementReviewRuntime,
  placementReviewWritesEnabled,
  resolvePlacementReviewStoreMode,
} from "@/server/vocabulary/placement-review-config";
import { saveCuratedPlacementReview } from "@/server/vocabulary/save-curated-placement-review";
import { SupabaseCuratedPlacementStore } from "@/server/vocabulary/supabase-curated-placement-store";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { sequentialIdFactory, makeEvidence } from "../learning/helpers";
import { CountingVocabularyRepository } from "../scheduler/counting-vocabulary-repository";
import { FakePlacementReviewsClient } from "./fake-placement-review-client";

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

const originalEnv = {
  PLACEMENT_REVIEW_STORE: process.env.PLACEMENT_REVIEW_STORE,
  PLACEMENT_REVIEW_WRITE_ENABLED: process.env.PLACEMENT_REVIEW_WRITE_ENABLED,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function sampleRow(overrides: Partial<{
  lexeme_id: string;
  band_id: string;
  status: string;
  source: string;
  provenance: unknown;
  review_note: string | null;
  reviewed_at: string;
}> = {}) {
  return {
    lexeme_id: ability.id,
    band_id: "BAND_3",
    status: "REVIEWED",
    source: "CURATED",
    provenance: [HUMAN_REVIEW_PROVENANCE],
    review_note: "ok",
    reviewed_at: now,
    ...overrides,
  };
}

describe("Supabase curated placement persistence", () => {
  it("D1: Supabase store maps rows to CuratedPlacementOverride", async () => {
    const mapped = mapVocabularyPlacementReviewRow(sampleRow());
    expect(mapped).toEqual({
      lexemeId: ability.id,
      bandId: "BAND_3",
      status: "REVIEWED",
      source: "CURATED",
      provenance: [HUMAN_REVIEW_PROVENANCE],
      reviewedAt: now,
      reviewNote: "ok",
    });
    const client = new FakePlacementReviewsClient();
    client.seed(sampleRow({ reviewed_at: "2026-09-17T12:00:00+00:00" }));
    const listed = await new SupabaseCuratedPlacementStore(client.asClient()).list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.lexemeId).toBe(ability.id);
    expect(listed[0]?.reviewedAt).toBe(now);
  });

  it("D2: upsert uses lexeme_id as the key", async () => {
    const client = new FakePlacementReviewsClient();
    const store = new SupabaseCuratedPlacementStore(client.asClient());
    await store.upsert({
      lexemeId: ability.id,
      bandId: "BAND_1",
      status: "REVIEWED",
      source: "CURATED",
      provenance: [HUMAN_REVIEW_PROVENANCE],
      reviewedAt: now,
    });
    await store.upsert({
      lexemeId: ability.id,
      bandId: "BAND_5",
      status: "REVIEWED",
      source: "CURATED",
      provenance: [HUMAN_REVIEW_PROVENANCE],
      reviewedAt: now,
      reviewNote: "changed",
    });
    expect(client.rows.size).toBe(1);
    expect(client.rows.get(ability.id)?.band_id).toBe("BAND_5");
    expect(toVocabularyPlacementReviewRow({
      lexemeId: ability.id,
      bandId: "BAND_5",
      status: "REVIEWED",
      source: "CURATED",
      provenance: [HUMAN_REVIEW_PROVENANCE],
      reviewedAt: now,
    }).lexeme_id).toBe(ability.id);
    const source = readFileSync(
      path.join(process.cwd(), "src/server/vocabulary/supabase-curated-placement-store.ts"),
      "utf8",
    );
    expect(source).toContain('onConflict: "lexeme_id"');
  });

  it("D3: list is bulk and does not do N+1 lexeme requests", async () => {
    const client = new FakePlacementReviewsClient();
    client.seed(sampleRow());
    client.seed(sampleRow({ lexeme_id: actor.id, band_id: "BAND_2", review_note: null }));
    const listed = await new SupabaseCuratedPlacementStore(client.asClient()).list();
    expect(listed).toHaveLength(2);
    expect(client.fromCalls).toEqual(["vocabulary_placement_reviews"]);
    expect(client.selectCalls).toBe(1);
    const source = readFileSync(
      path.join(process.cwd(), "src/server/vocabulary/supabase-curated-placement-store.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/getLexeme\(/);
    expect(source).toContain(".select(");
    expect(source).toContain('.order("lexeme_id"');
  });

  it("D4: unknown/malformed rows are rejected", () => {
    expect(() =>
      mapVocabularyPlacementReviewRow(sampleRow({ source: "INFERRED" })),
    ).toThrow(/CURATED/);
    expect(() =>
      mapVocabularyPlacementReviewRow(sampleRow({ provenance: [] })),
    ).toThrow(/provenance/);
    expect(() =>
      mapVocabularyPlacementReviewRow(sampleRow({ reviewed_at: "yesterday" })),
    ).toThrow(/reviewed_at/);
  });

  it("D5: server action still owns CURATED/source/provenance/reviewedAt", () => {
    const actions = readFileSync(
      path.join(process.cwd(), "src/app/debug/vocabulary-placement/actions.ts"),
      "utf8",
    );
    expect(actions).toContain("lexemeId: input.lexemeId");
    expect(actions).toContain("bandId: input.bandId");
    expect(actions).toContain("reviewNote: input.reviewNote");
    expect(actions).not.toContain("input.source");
    expect(actions).not.toContain("input.provenance");
    expect(actions).not.toContain("input.reviewedAt");
    expect(actions).toContain("saveCuratedPlacementReview");
    expect(actions).toContain("createCuratedPlacementStore");
    expect(actions).not.toContain("new FileCuratedPlacementStore");
  });

  it("D6/D7: write gate defaults disabled and refuses when the flag is absent", () => {
    delete process.env.PLACEMENT_REVIEW_WRITE_ENABLED;
    expect(placementReviewWritesEnabled()).toBe(false);
    process.env.PLACEMENT_REVIEW_WRITE_ENABLED = "true";
    expect(placementReviewWritesEnabled()).toBe(false);
    process.env.PLACEMENT_REVIEW_WRITE_ENABLED = "1";
    expect(placementReviewWritesEnabled()).toBe(true);
    const actions = readFileSync(
      path.join(process.cwd(), "src/app/debug/vocabulary-placement/actions.ts"),
      "utf8",
    );
    expect(actions).toContain("placementReviewWritesEnabled()");
    expect(actions).toContain("PLACEMENT_REVIEW_WRITE_DISABLED");
  });

  it("D8: service-role configuration is required for Supabase review writes", () => {
    delete process.env.PLACEMENT_REVIEW_STORE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-not-enough";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(resolvePlacementReviewStoreMode()).toBe("supabase");
    expect(() => createCuratedPlacementStore()).toThrow(CuratedPlacementConfigError);
    try {
      createCuratedPlacementStore();
    } catch (error) {
      expect(error).toBeInstanceOf(CuratedPlacementConfigError);
      expect((error as CuratedPlacementConfigError).code).toBe(
        "CURATED_PLACEMENT_SUPABASE_NOT_CONFIGURED",
      );
    }
    const serviceClient = readFileSync(
      path.join(process.cwd(), "src/lib/supabase/server.ts"),
      "utf8",
    );
    expect(serviceClient).toContain("createSupabaseServiceRoleClient");
    expect(serviceClient).toMatch(
      /createSupabaseServiceRoleClient[\s\S]*SUPABASE_SERVICE_ROLE_KEY/,
    );
    const storeFactory = readFileSync(
      path.join(process.cwd(), "src/server/vocabulary/create-curated-placement-store.ts"),
      "utf8",
    );
    expect(storeFactory).toContain("createSupabaseServiceRoleClient");
    expect(storeFactory).not.toContain("createSupabaseServerClient");
    expect(storeFactory).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("D9: file store remains available only as an explicit local/internal adapter", () => {
    process.env.PLACEMENT_REVIEW_STORE = "file";
    expect(createCuratedPlacementStore()).toBeInstanceOf(FileCuratedPlacementStore);
    const factory = readFileSync(
      path.join(process.cwd(), "src/server/vocabulary/create-curated-placement-store.ts"),
      "utf8",
    );
    expect(factory).not.toContain("isMemoryGameRuntime");
    expect(factory).not.toMatch(/FileCuratedPlacementStore[\s\S]*catch/);
    const playwright = readFileSync(
      path.join(process.cwd(), "playwright.config.ts"),
      "utf8",
    );
    expect(playwright).toContain('PLACEMENT_REVIEW_STORE: "file"');
    expect(playwright).toContain('PLACEMENT_REVIEW_WRITE_ENABLED: "1"');
  });

  it("D10: effective placement behavior is unchanged across stores", async () => {
    const client = new FakePlacementReviewsClient();
    const store = new SupabaseCuratedPlacementStore(client.asClient());
    await store.upsert({
      lexemeId: ability.id,
      bandId: "BAND_6",
      status: "REVIEWED",
      source: "CURATED",
      provenance: [HUMAN_REVIEW_PROVENANCE],
      reviewedAt: now,
    });
    const provider = new FileVocabularyPlacementProvider(
      dataset,
      definition,
      undefined,
      store,
    );
    const effective = await provider.listEffectivePlacements();
    expect(effective.find((row) => row.lexemeId === ability.id)).toMatchObject({
      bandId: "BAND_6",
      origin: "CURATED",
    });
    const fallback = mergeEffectivePlacements(
      [
        {
          lexemeId: actor.id,
          provisionalBand: {
            value: "BAND_4",
            source: "INFERRED",
            provenance: ["wordranger-provisional-band-generator/v1"],
          },
        },
      ],
      [],
    );
    expect(fallback[0]).toMatchObject({ bandId: "BAND_4", origin: "PROVISIONAL" });
  });

  it("D11: review coverage uses persisted curated records", async () => {
    const client = new FakePlacementReviewsClient();
    const store = new SupabaseCuratedPlacementStore(client.asClient());
    await applyCuratedPlacementImport({
      store,
      records: [
        {
          lexemeId: ability.id,
          bandId: "BAND_2",
          status: "REVIEWED",
          source: "CURATED",
          provenance: [HUMAN_REVIEW_PROVENANCE],
          reviewedAt: now,
        },
      ],
    });
    const provider = new FileVocabularyPlacementProvider(
      dataset,
      definition,
      undefined,
      store,
    );
    const coverage = await provider.summarizePlacementReview();
    expect(coverage.reviewedCount).toBe(1);
    expect(coverage.totalLexemes).toBe(dataset.lexemes.length);
    expect(coverage.unreviewedCount).toBe(dataset.lexemes.length - 1);
    expect(coverage.reviewedBandCounts.BAND_2).toBe(1);
  });

  it("D12: Scheduler does not query vocabulary_placement_reviews", async () => {
    const counted = new CountingVocabularyRepository(repository);
    await planLearningSession({
      userId: "d12-user",
      now,
      requestedNeedCount: 8,
      createId: sequentialIdFactory("d12"),
      random: new SeededRandomSource("d12"),
      vocabulary: counted,
      query: new InMemoryLearningStateQueryRepository(),
    });
    expect(counted.calls.listPlacementMetadata).toBe(0);
    const schedulerDir = path.join(process.cwd(), "src/domain/scheduler");
    for (const file of readdirSync(schedulerDir)) {
      if (!file.endsWith(".ts")) continue;
      expect(readFileSync(path.join(schedulerDir, file), "utf8")).not.toContain(
        "vocabulary_placement_reviews",
      );
    }
    expect(
      readFileSync(
        path.join(process.cwd(), "src/server/scheduler/plan-learning-session.ts"),
        "utf8",
      ),
    ).not.toContain("vocabulary_placement_reviews");
  });

  it("D13: Daily Training does not query vocabulary_placement_reviews", async () => {
    const counted = new CountingVocabularyRepository(repository);
    await createInMemoryDailyTrainingRuntime({
      userId: "d13-user",
      vocabulary: counted,
      now: () => now,
      createSessionId: sequentialIdFactory("d13s"),
      createId: sequentialIdFactory("d13t"),
      createEvidenceId: sequentialIdFactory("d13e"),
      requestedNeedCount: 8,
    })
      .createController()
      .start();
    expect(counted.calls.listPlacementMetadata).toBe(0);
    for (const relative of [
      "src/server/training/daily-training-controller.ts",
      "src/server/runtime/create-supabase-daily-training-runtime.ts",
      "src/app/train/actions.ts",
    ]) {
      expect(readFileSync(path.join(process.cwd(), relative), "utf8")).not.toContain(
        "vocabulary_placement_reviews",
      );
    }
  });

  it("D14: LearningEvidence / StudentLexemeModel schemas unchanged", () => {
    const model = createInitialStudentLexemeModel({
      id: "model-1",
      userId: "user-1",
      lexemeId: "lexeme-1",
      now,
      policyVersion: "v1",
    });
    expect(Object.keys(model).sort()).toEqual(FROZEN_STUDENT_LEXEME_MODEL_KEYS);
    expect(Object.keys(makeEvidence("ev-1", "s1", now)).sort()).toEqual(
      FROZEN_LEARNING_EVIDENCE_KEYS,
    );
  });

  it("D15: PublicLearningTask contains no placement review metadata", async () => {
    const started = await createInMemoryDailyTrainingRuntime({
      userId: "d15-user",
      now: () => now,
      createSessionId: sequentialIdFactory("d15s"),
      createId: sequentialIdFactory("d15t"),
      createEvidenceId: sequentialIdFactory("d15e"),
      requestedNeedCount: 8,
    })
      .createController()
      .start();
    const payload = JSON.stringify(started.task);
    expect(payload).not.toMatch(/curatedBand|provisionalBand|effectiveBand|vocabulary_placement_reviews/);
  });

  it("D16: Adaptive Placement remains PLACEMENT_DATA_BLOCKER", async () => {
    const listed = await repository.listPlacementMetadata();
    expect(
      assessAdaptivePlacementReadiness(listed, dataset.lexemes.length).status,
    ).toBe(ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER);
  });

  it("D17: migration creates FK to lexemes", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/202609170005_vocabulary_placement_reviews.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("create table if not exists vocabulary_placement_reviews");
    expect(sql).toMatch(/lexeme_id uuid primary key references lexemes \(id\)/);
    expect(sql).toContain("check (status = 'REVIEWED')");
    expect(sql).toContain("check (source = 'CURATED')");
    expect(sql).not.toContain("BAND_1");
  });

  it("D18: anon/browser cannot directly mutate the review table under intended DB policy", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/202609170005_vocabulary_placement_reviews.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("enable row level security");
    expect(sql).toContain(
      "revoke all on table vocabulary_placement_reviews from anon",
    );
    expect(sql).toContain(
      "revoke all on table vocabulary_placement_reviews from authenticated",
    );
    expect(sql).toContain(
      "grant select, insert, update on table vocabulary_placement_reviews to service_role",
    );
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/using \(true\)/);
    const actions = readFileSync(
      path.join(process.cwd(), "src/app/debug/vocabulary-placement/actions.ts"),
      "utf8",
    );
    expect(actions).toContain('"use server"');
    expect(actions).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(actions).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("diagnostics never include secret values", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://secret-project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "super-secret-service-role";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "super-secret-anon";
    process.env.PLACEMENT_REVIEW_STORE = "file";
    const diagnostics = describePlacementReviewRuntime();
    const serialized = JSON.stringify(diagnostics);
    expect(diagnostics.supabaseUrlConfigured).toBe(true);
    expect(diagnostics.serviceRoleConfigured).toBe(true);
    expect(diagnostics.anonKeyConfigured).toBe(true);
    expect(diagnostics.placementReviewStore).toBe("file");
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("secret-project");
  });

  it("import dry-run validates an empty file without writing", () => {
    const plan = planCuratedPlacementImport({ dataset, definition });
    expect(plan.valid).toBe(true);
    expect(plan.recordCount).toBe(0);
    const exported = serializeCuratedPlacementExport([]);
    expect(exported).toContain('"records": []');
  });

  it("save still owns CURATED fields when writing through the supabase store", async () => {
    const store = new InMemoryCuratedPlacementStore();
    const result = await saveCuratedPlacementReview({
      lexemeId: ability.id,
      bandId: "BAND_2",
      reviewNote: "note",
      now,
      dataset,
      definition,
      store,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.source).toBe("CURATED");
      expect(result.record.provenance).toEqual([HUMAN_REVIEW_PROVENANCE]);
      expect(result.record.reviewedAt).toBe(now);
    }
  });
});
