import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseDailyTrainingRuntime } from "@/server/runtime/create-supabase-daily-training-runtime";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import {
  cleanupProgressTestUser,
  type ProgressTestCleanupClient,
} from "./cleanup-progress-test-user";
import {
  supabaseProgressConfigured,
  supabaseProgressRunRequested,
  supabaseProgressWritesAllowed,
} from "./load-local-env";

const requireLive = supabaseProgressRunRequested();
const allowWrites = supabaseProgressWritesAllowed();
const configured = supabaseProgressConfigured();

describe("Daily Training identity (no live DB)", () => {
  it("T7: student routes use one stable placeholder userId and never accept it from the browser", () => {
    const trainActions = readFileSync(
      path.join(process.cwd(), "src/app/train/actions.ts"),
      "utf8",
    );
    const runtime = readFileSync(
      path.join(process.cwd(), "src/server/runtime/create-daily-training-runtime.ts"),
      "utf8",
    );
    const supabaseRuntime = readFileSync(
      path.join(
        process.cwd(),
        "src/server/runtime/create-supabase-daily-training-runtime.ts",
      ),
      "utf8",
    );
    expect(runtime).toContain("V1_PLACEHOLDER_USER_ID");
    expect(supabaseRuntime).toContain("V1_PLACEHOLDER_USER_ID");
    expect(trainActions).not.toMatch(/userId.*form|input\.userId|body\.userId/);
    expect(trainActions).toContain("createDailyTrainingRuntime().createController()");
    expect(V1_PLACEHOLDER_USER_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("T8: Daily Training client stores sessionId only, not a progress index", () => {
    const client = readFileSync(
      path.join(process.cwd(), "src/app/train/daily-training-play-client.tsx"),
      "utf8",
    );
    expect(client).toContain("DAILY_TRAINING_SESSION_KEY");
    expect(client).toContain("sessionStorage.setItem(DAILY_TRAINING_SESSION_KEY");
    expect(client).not.toMatch(/currentWordIndex|sourceIndex|masteryStage|retentionState/);
    expect(client).toContain("resumeDailyTrainingSession(sessionId)");
  });
});

describe.skipIf(!requireLive)("Supabase progress write opt-in", () => {
  it("refuses to mutate without ALLOW_SUPABASE_PROGRESS_WRITES=1", () => {
    if (!allowWrites) {
      throw new Error(
        "Refusing Supabase progress-test writes. Set ALLOW_SUPABASE_PROGRESS_WRITES=1 in addition to RUN_SUPABASE_PROGRESS=1 before mutating the live database.",
      );
    }
  });
});

describe.skipIf(!requireLive || !allowWrites)(
  "Daily Training Supabase progress persistence",
  () => {
    if (!configured) {
      throw new Error(
        "PROGRESS_RUNTIME_BLOCKER: RUN_SUPABASE_PROGRESS=1 but Supabase env is missing",
      );
    }
    const userId = crypto.randomUUID();
    const client = createSupabaseServerClient();

    afterAll(async () => {
      if (!client) {
        throw new Error(
          "Progress test cleanup failed: Supabase client is missing",
        );
      }
      await cleanupProgressTestUser(
        client as unknown as ProgressTestCleanupClient,
        userId,
      );
    });

    it("P1–P9 / T1–T6 / T9: Evidence and snapshots survive runtime recreation", async () => {
      if (requireLive && !client) {
        throw new Error(
          "PROGRESS_RUNTIME_BLOCKER: RUN_SUPABASE_PROGRESS=1 but Supabase env is missing",
        );
      }
      expect(client).toBeTruthy();
      const sampleLexemeId = loadVocabularyDataset().lexemes[0]?.id;
      expect(sampleLexemeId).toBeTruthy();
      const { data: lexemeRow, error: lexemeError } = await client!
        .from("lexemes")
        .select("id")
        .eq("id", sampleLexemeId)
        .maybeSingle();
      if (lexemeError || !lexemeRow) {
        throw new Error(
          "PROGRESS_RUNTIME_BLOCKER: bundled lexeme UUIDs are missing from Supabase lexemes. Import vocabulary before progress can persist (FK learning_evidence.lexeme_id → lexemes.id).",
        );
      }

      const firstRuntime = createSupabaseDailyTrainingRuntime({
        client: client!,
        userId,
        requestedNeedCount: 3,
      });
      expect(firstRuntime.learning.constructor.name).toBe(
        "SupabaseLearningRepository",
      );
      const firstController = firstRuntime.createController();
      const started = await firstController.start();
      const firstRecord = await firstRuntime.sessions.get(started.session.sessionId);
      const firstLexemes = (firstRecord?.needs ?? []).map((need) => need.lexemeId);
      expect(firstLexemes).toHaveLength(3);
      expect(firstRecord?.userId).toBe(userId);

      const missLexemeId = firstLexemes[2];
      let current = started;
      for (let index = 0; index < 3; index += 1) {
        const assigned = await firstRuntime.tasks.getTaskForEvaluation(
          current.task.id,
        );
        expect(assigned?.assignment.userId).toBe(userId);
        const key = assigned!.task.answerKey;
        const correct = current.task.lexemeId !== missLexemeId;
        const intent =
          current.task.responseContract.kind === "CHOICE"
            ? {
                kind: "CHOICE" as const,
                optionId: correct
                  ? key.correctOptionIds[0]
                  : (current.task.responseContract.options.find(
                      (option) => option.id !== key.correctOptionIds[0],
                    )?.id ?? key.correctOptionIds[0]),
              }
            : {
                kind: "TEXT_INPUT" as const,
                value: correct ? (key.exactAcceptedTexts[0] ?? "word") : "zzzz",
              };
        await firstController.submit({
          sessionId: current.session.sessionId,
          taskId: current.task.id,
          intent,
          responseTimeMs: 400,
        });
        const continued = await firstController.continue(current.session.sessionId);
        if (continued.completed) {
          break;
        }
        current = {
          session: continued.progress,
          task: continued.task!,
          rendererGameType: continued.rendererGameType!,
        };
      }

      const { data: evidenceRows, error: evidenceError } = await client!
        .from("learning_evidence")
        .select("id, user_id, lexeme_id, outcome, task_id")
        .eq("user_id", userId);
      expect(evidenceError).toBeNull();
      expect(evidenceRows).toHaveLength(3);
      expect(new Set(evidenceRows!.map((row) => row.user_id))).toEqual(
        new Set([userId]),
      );
      expect(new Set(evidenceRows!.map((row) => row.task_id)).size).toBe(3);

      const firstQuery = firstRuntime.learningStateQuery;
      const modelsAfterFirst = await firstQuery.listStudentLexemeModels(userId);
      expect(modelsAfterFirst).toHaveLength(3);
      expect(modelsAfterFirst.every((model) => model.userId === userId)).toBe(true);
      const strongIds = firstLexemes.filter((id) => id !== missLexemeId);
      for (const lexemeId of strongIds) {
        const model = modelsAfterFirst.find((item) => item.lexemeId === lexemeId);
        expect(model?.masteryStage).not.toBe(MasteryStage.UNSEEN);
        expect(model?.lastSuccessAt).toBeTruthy();
      }
      const failedModel = modelsAfterFirst.find(
        (item) => item.lexemeId === missLexemeId,
      );
      expect(failedModel?.masteryStage).not.toBe(MasteryStage.UNSEEN);
      expect(failedModel?.lastFailureAt).toBeTruthy();
      expect(
        evidenceRows!.some(
          (row) =>
            row.lexeme_id === missLexemeId &&
            row.outcome === EvidenceOutcome.INCORRECT,
        ),
      ).toBe(true);

      const resumedSame = await firstController.resume(started.session.sessionId);
      expect(resumedSame.completed).toBe(true);
      const { count: evidenceAfterResume } = await client!
        .from("learning_evidence")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      expect(evidenceAfterResume).toBe(3);

      const secondRuntime = createSupabaseDailyTrainingRuntime({
        client: client!,
        userId,
        requestedNeedCount: 4,
      });
      expect(secondRuntime.learning).not.toBe(firstRuntime.learning);
      const modelsFromNewRuntime =
        await secondRuntime.learningStateQuery.listStudentLexemeModels(userId);
      expect(modelsFromNewRuntime).toHaveLength(3);
      for (const lexemeId of strongIds) {
        const model = await secondRuntime.learning.getStudentLexemeModel(
          userId,
          lexemeId,
        );
        expect(model?.masteryStage).not.toBe(MasteryStage.UNSEEN);
        const evidence = await secondRuntime.learning.getEvidenceForLexeme(
          userId,
          lexemeId,
        );
        expect(evidence).toHaveLength(1);
        expect(evidence[0]?.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
      }

      const second = await secondRuntime.createController().start();
      expect(second.session.sessionId).not.toBe(started.session.sessionId);
      expect(second.session.planId).not.toBe(started.session.planId);
      const secondRecord = await secondRuntime.sessions.get(
        second.session.sessionId,
      );
      expect(secondRecord?.userId).toBe(userId);
      const secondNeeds = secondRecord?.needs ?? [];
      const secondLexemes = secondNeeds.map((need) => need.lexemeId);
      expect(secondLexemes).toContain(missLexemeId);
      expect(
        secondNeeds.find((need) => need.lexemeId === missLexemeId)?.reason,
      ).not.toBe("NEW_WORD");
      for (const lexemeId of strongIds) {
        expect(
          secondNeeds.some(
            (need) =>
              need.lexemeId === lexemeId &&
              need.reason === "NEW_WORD" &&
              need.targetSkill === "MEANING_RECOGNITION",
          ),
        ).toBe(false);
      }
      expect(secondLexemes.some((lexemeId) => !firstLexemes.includes(lexemeId))).toBe(
        true,
      );

      const { count: evidenceAfterSecondStart } = await client!
        .from("learning_evidence")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      expect(evidenceAfterSecondStart).toBe(3);
    }, 90_000);
  },
);
