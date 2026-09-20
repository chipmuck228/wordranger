import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { RANGER_TRIAL_GAME_ID, V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import type { ContextLabRunRepository } from "@/server/context-lab/context-lab-run.types";
import {
  acknowledgeUntilFrozen,
  assertGuided,
  assertRecorded,
  collectKeys,
  createMealLabHarness,
  FORBIDDEN_CLIENT_FIELDS,
} from "./helpers";

const CONTROLLER_SOURCE = readFileSync(
  join(process.cwd(), "src/server/context-lab/meal-context-lab-controller.ts"),
  "utf8",
);
const CANDIDATE_README = readFileSync(
  join(process.cwd(), "src/contextual-learning/candidate-v0/README.md"),
  "utf8",
);

describe("Context Lab frozen task submission", () => {
  it("routes correct and incorrect TEXT_INPUT through submitTaskAction only", async () => {
    expect(CONTROLLER_SOURCE).toContain("submitTaskAction");
    expect(CONTROLLER_SOURCE).not.toContain("DefaultTaskEvaluator");
    expect(CONTROLLER_SOURCE).not.toContain("createLearningEvidenceFromTaskEvaluation");
    expect(CONTROLLER_SOURCE).not.toContain("processEvidence(");

    const correctHarness = createMealLabHarness();
    const correctPreview = await acknowledgeUntilFrozen(correctHarness.controller);
    const correct = await correctHarness.controller.submitFrozenTask({
      runId: correctPreview.handle.runId,
      revision: correctPreview.handle.revision,
      taskId: correctPreview.task.id,
      action: { kind: "TEXT_INPUT", value: "spoon" },
      responseTimeMs: 1200,
    });
    assertRecorded(correct);
    expect(correct.feedback.status).toBe("CORRECT");
    expect(correct.feedback.message).toBe("答对了！");
    expect(correct.recordedMessage).toBe("这次练习已记录。");
    expect(correct.recordedMessage).not.toMatch(/掌握|永远记住|学习完成|能力提升/);

    const evidence = correctHarness.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.taskId).toBe(correctPreview.task.id);
    expect(evidence[0]?.sessionId).toBe(correctPreview.handle.runId);
    expect(evidence[0]?.gameId).toBe(RANGER_TRIAL_GAME_ID);
    expect(evidence[0]?.userId).toBe(V1_PLACEHOLDER_USER_ID);
    expect(evidence[0]?.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    const model = await correctHarness.learning.getStudentLexemeModel(
      V1_PLACEHOLDER_USER_ID,
      evidence[0]!.lexemeId,
    );
    expect(model).not.toBeNull();
    expect(model?.evidenceCount).toBe(1);

    const stored = await correctHarness.repository.get({
      runId: correctPreview.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.experienceRun.status).toBe("COMPLETED");
    expect(JSON.stringify(stored?.experienceRun)).not.toContain("typedAnswer");
    expect(JSON.stringify(stored?.experienceRun)).not.toContain('"value":"spoon"');
    expect(JSON.stringify(stored?.experienceRun)).not.toContain("exactAcceptedTexts");

    const incorrectHarness = createMealLabHarness();
    const incorrectPreview = await acknowledgeUntilFrozen(incorrectHarness.controller);
    const incorrect = await incorrectHarness.controller.submitFrozenTask({
      runId: incorrectPreview.handle.runId,
      revision: incorrectPreview.handle.revision,
      taskId: incorrectPreview.task.id,
      action: { kind: "TEXT_INPUT", value: "fork" },
    });
    assertRecorded(incorrect);
    expect(incorrect.feedback.status).toBe("INCORRECT");
    expect(incorrect.recordedMessage).toBe("这次练习已记录。");
    expect(incorrect.recordedMessage).not.toMatch(/掌握/);
    const incorrectEvidence = incorrectHarness.learning.listEvidenceForUser(
      V1_PLACEHOLDER_USER_ID,
    );
    expect(incorrectEvidence).toHaveLength(1);
    expect(incorrectEvidence[0]?.outcome).toBe(EvidenceOutcome.INCORRECT);
    const incorrectRun = await incorrectHarness.repository.get({
      runId: incorrectPreview.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(incorrectRun?.experienceRun.status).toBe("COMPLETED");
  });

  it("rejects wrong identity, stale revision, guided-state, and unsupported actions", async () => {
    const harness = createMealLabHarness();
    const first = await harness.controller.start();
    assertGuided(first);
    const guidedSubmit = await harness.controller.submitFrozenTask({
      runId: first.handle.runId,
      revision: first.handle.revision,
      taskId: "00000000-0000-5000-8000-000000000099",
      action: { kind: "TEXT_INPUT", value: "spoon" },
    });
    expect(guidedSubmit.kind).toBe("ERROR");

    const preview = await acknowledgeUntilFrozen(harness.controller, first);
    const wrongTask = await harness.controller.submitFrozenTask({
      runId: preview.handle.runId,
      revision: preview.handle.revision,
      taskId: "00000000-0000-5000-8000-000000000099",
      action: { kind: "TEXT_INPUT", value: "spoon" },
    });
    expect(wrongTask.kind).toBe("ERROR");

    const wrongRun = await harness.controller.submitFrozenTask({
      runId: "00000000-0000-4000-8000-999999999999",
      revision: preview.handle.revision,
      taskId: preview.task.id,
      action: { kind: "TEXT_INPUT", value: "spoon" },
    });
    expect(wrongRun.kind).toBe("ERROR");

    const stale = await harness.controller.submitFrozenTask({
      runId: preview.handle.runId,
      revision: preview.handle.revision - 1,
      taskId: preview.task.id,
      action: { kind: "TEXT_INPUT", value: "spoon" },
    });
    expect(stale.kind).toBe("ERROR");

    const unsupported = await harness.controller.submitFrozenTask({
      runId: preview.handle.runId,
      revision: preview.handle.revision,
      taskId: preview.task.id,
      action: { kind: "CHOICE", value: "spoon" } as never,
    });
    expect(unsupported.kind).toBe("ERROR");

    const withOutcome = await harness.controller.submitFrozenTask({
      runId: preview.handle.runId,
      revision: preview.handle.revision,
      taskId: preview.task.id,
      action: { kind: "TEXT_INPUT", value: "spoon" },
      outcome: "INDEPENDENT_CORRECT",
    } as never);
    expect(withOutcome.kind).toBe("ERROR");
    expect(harness.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(0);
  });

  it("duplicate and concurrent submits create one Evidence and one completed run", async () => {
    const harness = createMealLabHarness();
    const preview = await acknowledgeUntilFrozen(harness.controller);
    const first = await harness.controller.submitFrozenTask({
      runId: preview.handle.runId,
      revision: preview.handle.revision,
      taskId: preview.task.id,
      action: { kind: "TEXT_INPUT", value: "spoon" },
    });
    assertRecorded(first);
    const replay = await harness.controller.submitFrozenTask({
      runId: preview.handle.runId,
      revision: preview.handle.revision,
      taskId: preview.task.id,
      action: { kind: "TEXT_INPUT", value: "fork" },
    });
    assertRecorded(replay);
    expect(replay.feedback.status).toBe("CORRECT");
    expect(harness.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
    const stored = await harness.repository.get({
      runId: preview.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.revision).toBe(first.handle.revision);

    const concurrent = createMealLabHarness();
    const concurrentPreview = await acknowledgeUntilFrozen(concurrent.controller);
    const [left, right] = await Promise.all([
      concurrent.controller.submitFrozenTask({
        runId: concurrentPreview.handle.runId,
        revision: concurrentPreview.handle.revision,
        taskId: concurrentPreview.task.id,
        action: { kind: "TEXT_INPUT", value: "spoon" },
      }),
      concurrent.controller.submitFrozenTask({
        runId: concurrentPreview.handle.runId,
        revision: concurrentPreview.handle.revision,
        taskId: concurrentPreview.task.id,
        action: { kind: "TEXT_INPUT", value: "spoon" },
      }),
    ]);
    expect([left.kind, right.kind].every((kind) => kind === "FROZEN_TASK_RECORDED")).toBe(
      true,
    );
    expect(concurrent.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
    const concurrentRun = await concurrent.repository.get({
      runId: concurrentPreview.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(concurrentRun?.experienceRun.status).toBe("COMPLETED");
    expect(concurrentRun?.revision).toBe(4);
  });

  it("reconciles Evidence-success / run-CAS-failure without a second Evidence", async () => {
    const harness = createMealLabHarness();
    const inner = harness.repository;
    let failCompletedCas = true;
    const wrapping: ContextLabRunRepository = {
      create: (record) => inner.create(record),
      get: (input) => inner.get(input),
      async saveIfRevision(input) {
        if (failCompletedCas && input.nextRun.status === "COMPLETED") {
          failCompletedCas = false;
          return { ok: false, reason: "REVISION_CONFLICT" };
        }
        return inner.saveIfRevision(input);
      },
    };
    const isolated = createMealLabHarness({
      repository: wrapping as never,
      learningTasks: harness.learningTasks,
      learning: harness.learning,
    });
    const preview = await acknowledgeUntilFrozen(isolated.controller);
    const first = await isolated.controller.submitFrozenTask({
      runId: preview.handle.runId,
      revision: preview.handle.revision,
      taskId: preview.task.id,
      action: { kind: "TEXT_INPUT", value: "spoon" },
    });
    expect(isolated.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
    if (first.kind === "ERROR") {
      const retry = await isolated.controller.submitFrozenTask({
        runId: preview.handle.runId,
        revision: preview.handle.revision,
        taskId: preview.task.id,
        action: { kind: "TEXT_INPUT", value: "fork" },
      });
      assertRecorded(retry);
      expect(retry.feedback.status).toBe("CORRECT");
    } else {
      assertRecorded(first);
    }
    expect(isolated.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
    const model = await isolated.learning.getStudentLexemeModel(
      V1_PLACEHOLDER_USER_ID,
      "lex-spoon",
    );
    expect(model?.evidenceCount).toBe(1);
    const completed = await isolated.repository.get({
      runId: preview.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(completed?.experienceRun.status).toBe("COMPLETED");
  });

  it("already-completed run cannot submit again and public payload stays safe", async () => {
    const harness = createMealLabHarness();
    const preview = await acknowledgeUntilFrozen(harness.controller);
    const recorded = await harness.controller.submitFrozenTask({
      runId: preview.handle.runId,
      revision: preview.handle.revision,
      taskId: preview.task.id,
      action: { kind: "TEXT_INPUT", value: "spoon" },
    });
    assertRecorded(recorded);
    const keys = collectKeys(recorded);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
    const again = await harness.controller.submitFrozenTask({
      runId: recorded.handle.runId,
      revision: recorded.handle.revision,
      taskId: preview.task.id,
      action: { kind: "TEXT_INPUT", value: "spoon" },
    });
    assertRecorded(again);
    expect(harness.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
    expect(CANDIDATE_README).not.toMatch(/Candidate Evidence|candidate evidence/);
  });
});
