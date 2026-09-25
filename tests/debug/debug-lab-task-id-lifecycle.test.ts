import { afterEach, describe, expect, it } from "vitest";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import {
  generateTaskFromScheduledNeed,
  getAssignedSchedulerDebugTask,
  loadSchedulerDebugProfile,
  planDebugSchedulerSession,
  resetSchedulerDebugLab,
} from "@/app/debug/scheduler/actions";
import { DEBUG_SESSION_ID as SCHEDULER_SESSION_ID, DEBUG_USER_ID as SCHEDULER_USER_ID } from "@/app/debug/scheduler/debug-ids";
import {
  generateDebugTask,
  getAssignedDebugTask,
  resetDebugTaskLab,
} from "@/app/debug/tasks/actions";
import {
  DEBUG_SESSION_ID as TASK_SESSION_ID,
  DEBUG_USER_ID as TASK_USER_ID,
} from "@/app/debug/tasks/debug-ids";
import { getVocabularyDataset } from "@/server/vocabulary/dataset";

function generatedTask(result: Awaited<ReturnType<typeof generateDebugTask>>) {
  expect(result.generation.status).toBe("GENERATED");
  if (result.generation.status !== "GENERATED" || !result.assignment) {
    throw new Error(result.generation.status === "GENERATED" ? "missing assignment" : result.generation.reason);
  }
  return {
    task: result.generation.value,
    assignment: result.assignment,
  };
}

afterEach(async () => {
  await resetDebugTaskLab();
  await resetSchedulerDebugLab();
});

describe("Debug Task Lab ID lifecycle", () => {
  it("keeps two generates unique on the module-level repository", async () => {
    await resetDebugTaskLab();
    const quiet = getVocabularyDataset().lexemes.find((lexeme) => lexeme.lemma === "quiet");
    expect(quiet).toBeTruthy();
    const first = generatedTask(
      await generateDebugTask({
        lexemeId: quiet!.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
        reason: "NEW_WORD",
        relatedLexemeId: "",
        seed: "debug",
        difficulty: 0.4,
      }),
    );
    const second = generatedTask(
      await generateDebugTask({
        lexemeId: quiet!.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
        reason: "NEW_WORD",
        relatedLexemeId: "",
        seed: "debug",
        difficulty: 0.4,
      }),
    );
    const firstId = first.task.publicTask.id;
    const secondId = second.task.publicTask.id;
    expect(firstId).toMatch(/^debug-task-\d+$/);
    expect(secondId).toMatch(/^debug-task-\d+$/);
    expect(secondId).not.toBe(firstId);
    expect(first.assignment).toEqual({
      userId: TASK_USER_ID,
      sessionId: TASK_SESSION_ID,
    });
    expect(second.assignment).toEqual({
      userId: TASK_USER_ID,
      sessionId: TASK_SESSION_ID,
    });
    const storedFirst = await getAssignedDebugTask(firstId);
    const storedSecond = await getAssignedDebugTask(secondId);
    expect(storedFirst?.task.publicTask.id).toBe(firstId);
    expect(storedSecond?.task.publicTask.id).toBe(secondId);
    expect(storedFirst?.task.answerKey.taskId).toBe(firstId);
    expect(storedSecond?.task.answerKey.taskId).toBe(secondId);
    expect(storedFirst?.assignment).toEqual(first.assignment);
    expect(storedSecond?.assignment).toEqual(second.assignment);
  });
});

describe("Debug Scheduler ID lifecycle", () => {
  it("plans twice and generates two tasks without colliding", async () => {
    await loadSchedulerDebugProfile("new");
    const firstPlan = await planDebugSchedulerSession({ seed: "scheduler-debug" });
    const secondPlan = await planDebugSchedulerSession({ seed: "scheduler-debug" });
    expect(firstPlan.plan.needs.length).toBeGreaterThan(0);
    expect(secondPlan.plan.needs.length).toBeGreaterThan(0);
    const need = firstPlan.plan.needs[0]!;
    const first = generatedTask(
      await generateTaskFromScheduledNeed({ need, seed: "scheduler-debug" }),
    );
    const second = generatedTask(
      await generateTaskFromScheduledNeed({ need, seed: "scheduler-debug" }),
    );
    const firstId = first.task.publicTask.id;
    const secondId = second.task.publicTask.id;
    expect(firstId).toMatch(/^sched-task-\d+$/);
    expect(secondId).toMatch(/^sched-task-\d+$/);
    expect(secondId).not.toBe(firstId);
    expect(first.assignment).toEqual({
      userId: SCHEDULER_USER_ID,
      sessionId: SCHEDULER_SESSION_ID,
    });
    const storedFirst = await getAssignedSchedulerDebugTask(firstId);
    const storedSecond = await getAssignedSchedulerDebugTask(secondId);
    expect(storedFirst?.task.publicTask.id).toBe(firstId);
    expect(storedSecond?.task.publicTask.id).toBe(secondId);
    expect(storedFirst?.assignment).toEqual(first.assignment);
    expect(storedSecond?.assignment).toEqual(second.assignment);
  });
});
