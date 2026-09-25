import { describe, expect, it } from "vitest";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { contextLabBoundLexemeId } from "@/server/context-lab/bind-generated-task-to-vocabulary";
import { contextLabFrozenTaskId } from "@/server/context-lab/context-lab-frozen-task-id";
import { toGeneratedLearningTask } from "@/server/context-lab/to-generated-learning-task";
import { ensureAssignedGeneratedTask } from "@/server/tasks/ensure-assigned-generated-task";
import { LearningTaskType } from "@/domain/tasks/task-type";
import {
  acknowledgeUntilFrozen,
  assertFrozen,
  assertGuided,
  collectKeys,
  createMealLabHarness,
  FORBIDDEN_CLIENT_FIELDS,
} from "./helpers";

describe("Context Lab frozen task assignment", () => {
  it("persists a generated frozen task on the final Guided acknowledgement", async () => {
    const harness = createMealLabHarness();
    const screen = await acknowledgeUntilFrozen(harness.controller);
    const assigned = await harness.learningTasks.getTaskForEvaluation({
      taskId: screen.task.id,
      userId: V1_PLACEHOLDER_USER_ID,
      sessionId: screen.handle.runId,
    });
    expect(assigned).not.toBeNull();
    expect(assigned?.task.publicTask.taskType).toBe(
      LearningTaskType.ACTIVE_RECALL_TYPING,
    );
    expect(assigned?.assignment.userId).toBe(V1_PLACEHOLDER_USER_ID);
    expect(assigned?.assignment.sessionId).toBe(screen.handle.runId);
    expect(screen.task.lexemeId).toBe(contextLabBoundLexemeId("lex-soup"));
    expect(assigned?.task.publicTask.lexemeId).toBe(screen.task.lexemeId);
  });

  it("uses a deterministic UUID from run ID + step ID", async () => {
    const harness = createMealLabHarness();
    const screen = await acknowledgeUntilFrozen(harness.controller);
    const stored = await harness.repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    const step = stored?.experienceRun.planSnapshot.plan.steps[5];
    expect(step).toBeDefined();
    expect(screen.task.id).toBe(
      contextLabFrozenTaskId(screen.handle.runId, step!.id),
    );
    expect(screen.task.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("returns only PublicLearningTask and keeps AnswerKey in the task repository", async () => {
    const harness = createMealLabHarness();
    const screen = await acknowledgeUntilFrozen(harness.controller);
    const keys = collectKeys(screen);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
    expect(JSON.stringify(screen)).not.toContain("exactAcceptedTexts");
    const assigned = await harness.learningTasks.getTaskForEvaluation({
      taskId: screen.task.id,
      userId: V1_PLACEHOLDER_USER_ID,
      sessionId: screen.handle.runId,
    });
    expect(assigned?.task.answerKey.exactAcceptedTexts).toEqual(["soup"]);
    const stored = await harness.repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(JSON.stringify(stored?.experienceRun)).not.toContain("exactAcceptedTexts");
    expect(JSON.stringify(stored?.experienceRun)).not.toContain("answerKey");
  });

  it("reuses an identical existing assignment", async () => {
    const harness = createMealLabHarness();
    const first = await acknowledgeUntilFrozen(harness.controller);
    const assigned = await harness.learningTasks.getTaskForEvaluation({
      taskId: first.task.id,
      userId: V1_PLACEHOLDER_USER_ID,
      sessionId: first.handle.runId,
    });
    expect(assigned).not.toBeNull();
    const reused = await ensureAssignedGeneratedTask({
      tasks: harness.learningTasks,
      task: assigned!.task,
      assignment: assigned!.assignment,
    });
    expect(reused).toEqual({ ok: true, reused: true });
    const loaded = await harness.controller.loadCurrent({ runId: first.handle.runId });
    assertFrozen(loaded);
    expect(loaded.task.id).toBe(first.task.id);
  });

  it("rejects a conflicting existing assignment", async () => {
    const harness = createMealLabHarness();
    let screen = await harness.controller.start();
    for (let index = 0; index < 4; index += 1) {
      assertGuided(screen);
      screen = await harness.controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      });
    }
    assertGuided(screen);
    const stored = await harness.repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    const step = stored!.experienceRun.planSnapshot.plan.steps[5];
    const taskId = contextLabFrozenTaskId(screen.handle.runId, step.id);
    const donor = createMealLabHarness();
    const donorScreen = await acknowledgeUntilFrozen(donor.controller);
    const donorAssigned = await donor.learningTasks.getTaskForEvaluation({
      taskId: donorScreen.task.id,
      userId: V1_PLACEHOLDER_USER_ID,
      sessionId: donorScreen.handle.runId,
    });
    const conflicting = toGeneratedLearningTask({
      publicTask: { ...donorAssigned!.task.publicTask, id: taskId },
      answerKey: {
        ...donorAssigned!.task.answerKey,
        taskId,
        exactAcceptedTexts: ["fork"],
      },
    });
    await harness.learningTasks.saveGeneratedTask({
      task: conflicting,
      assignment: {
        userId: V1_PLACEHOLDER_USER_ID,
        sessionId: screen.handle.runId,
      },
    });
    const rejected = await harness.controller.acknowledge({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      activityId: screen.activity.id,
    });
    expect(rejected.kind).toBe("ERROR");
    if (rejected.kind === "ERROR") {
      expect(rejected.code).toContain("CONTEXT_LAB_TASK_CONFLICT");
    }
  });

  it("concurrent final acknowledgements expose only the winning assigned task", async () => {
    const harness = createMealLabHarness();
    let screen = await harness.controller.start();
    for (let index = 0; index < 4; index += 1) {
      assertGuided(screen);
      screen = await harness.controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      });
    }
    assertGuided(screen);
    const [a, b] = await Promise.all([
      harness.controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      }),
      harness.controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      }),
    ]);
    const frozen = [a, b].filter((item) => item.kind === "FROZEN_TASK_PREVIEW");
    const errors = [a, b].filter((item) => item.kind === "ERROR");
    expect(frozen).toHaveLength(1);
    expect(errors).toHaveLength(1);
    if (frozen[0]?.kind !== "FROZEN_TASK_PREVIEW") {
      throw new Error("expected one frozen winner");
    }
    expect(harness.learningTasks.listTaskIds()).toEqual([frozen[0].task.id]);
    const current = await harness.controller.loadCurrent({
      runId: screen.handle.runId,
    });
    assertFrozen(current);
    expect(current.task.id).toBe(frozen[0].task.id);
  });
});
