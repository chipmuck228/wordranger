import { describe, expect, it } from "vitest";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET } from "@/contextual-learning/candidate-v0/content";
import { mealColdProbeTargets } from "@/server/context-lab/meal-probe-targets";
import { routingResultsForProbe } from "@/server/context-lab/meal-probe-orchestration";
import { createMealLabHarness } from "./helpers";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import type { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import type { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";

const READY_LEMMAS = ["soup", "bowl", "spoon", "fork", "cup"] as const;

function assertKind<K extends ContextLabCurrentScreen["kind"]>(
  screen: ContextLabCurrentScreen,
  kind: K,
): asserts screen is Extract<ContextLabCurrentScreen, { kind: K }> {
  if (screen.kind !== kind) {
    throw new Error(`expected ${kind}, got ${screen.kind}`);
  }
}

function runHandle(screen: ContextLabCurrentScreen) {
  if (screen.kind === "ERROR") {
    throw new Error(`${screen.code}: ${screen.message}`);
  }
  return screen.handle;
}

async function continueFrom(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  const handle = runHandle(screen);
  return controller.continueProbe({
    runId: handle.runId,
    revision: handle.revision,
  });
}

async function submitTyping(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
  value: string,
) {
  assertKind(screen, "FROZEN_TASK_PREVIEW");
  return controller.submitFrozenTask({
    runId: screen.handle.runId,
    revision: screen.handle.revision,
    taskId: screen.task.id,
    action: { kind: "TEXT_INPUT", value },
  });
}

async function choiceIds(
  learningTasks: InMemoryLearningTaskRepository,
  taskId: string,
  sessionId: string,
) {
  const assigned = await learningTasks.getTaskForEvaluation({
    taskId,
    userId: V1_PLACEHOLDER_USER_ID,
    sessionId,
  });
  if (!assigned || assigned.task.publicTask.responseContract.kind !== "CHOICE") {
    throw new Error("choice task");
  }
  return {
    correct: assigned.task.answerKey.correctOptionIds[0] ?? "",
    wrong:
      assigned.task.publicTask.responseContract.options.find(
        (option) => !assigned.task.answerKey.correctOptionIds.includes(option.id),
      )?.id ?? "",
  };
}

async function submitChoice(
  controller: MealContextLabController,
  learningTasks: InMemoryLearningTaskRepository,
  screen: ContextLabCurrentScreen,
  correct: boolean,
) {
  assertKind(screen, "FROZEN_TASK_PREVIEW");
  const ids = await choiceIds(learningTasks, screen.task.id, screen.handle.runId);
  return controller.submitFrozenTask({
    runId: screen.handle.runId,
    revision: screen.handle.revision,
    taskId: screen.task.id,
    action: { kind: "CHOICE", optionId: correct ? ids.correct : ids.wrong },
  });
}

async function reachPlateTask(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  let current = screen;
  for (const lemma of READY_LEMMAS) {
    if (current.kind !== "FROZEN_TASK_PREVIEW") {
      current = await continueFrom(controller, current);
    }
    current = await submitTyping(controller, current, lemma);
    current = await continueFrom(controller, current);
  }
  if (current.kind !== "FROZEN_TASK_PREVIEW") {
    current = await continueFrom(controller, current);
  }
  assertKind(current, "FROZEN_TASK_PREVIEW");
  return current;
}

async function walkGuidedToFrozen(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  let current = screen;
  while (current.kind === "GUIDED") {
    current = await controller.acknowledge({
      runId: current.handle.runId,
      revision: current.handle.revision,
      activityId: current.activity.id,
    });
  }
  return current;
}

describe("Meal Context Lab plate routing after experiment promotion", () => {
  it("exposes exactly six stable Probe targets ending in plate", () => {
    const targets = mealColdProbeTargets();
    expect(targets.map((item) => item.entityId)).toEqual([
      "home-soup",
      "home-bowl",
      "home-spoon",
      "home-fork",
      "home-cup",
      "home-plate",
    ]);
    expect(targets.some((item) => item.entityId.includes("served-food"))).toBe(false);
    expect(targets.some((item) => item.entityId.includes("drink"))).toBe(false);
    expect(targets.some((item) => item.target.senseId === "drink#consume-liquid")).toBe(false);
    expect(targets.at(-1)?.target).toEqual(MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET);
  });

  it("routes independent plate recall to READY and skips recognition", async () => {
    const { controller, repository } = createMealLabHarness({ beginAt: "PROBE" });
    let screen: ContextLabCurrentScreen = await reachPlateTask(
      controller,
      await controller.start(),
    );
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    expect(screen.task.prompt).toEqual({
      kind: "MEANING_TEXT",
      text: "写出当前物品的英文单词",
    });
    expect(JSON.stringify(screen.task.prompt)).not.toMatch(/plate/i);
    screen = await submitTyping(controller, screen, "plate");
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    const stored = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(routingResultsForProbe(stored!.probe!).at(-1)).toMatchObject({
      target: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
      disposition: "READY",
    });
    expect(screen.canHandoffToBuild).toBe(false);
    expect(screen.canHandoffToStrengthen).toBe(false);
  });

  it("routes plate recall-wrong + recognition-correct to STRENGTHEN only", async () => {
    const { controller, learningTasks, repository } = createMealLabHarness({
      beginAt: "PROBE",
    });
    let screen: ContextLabCurrentScreen = await reachPlateTask(
      controller,
      await controller.start(),
    );
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    const assigned = await learningTasks.getTaskForEvaluation({
      taskId: screen.task.id,
      userId: V1_PLACEHOLDER_USER_ID,
      sessionId: screen.handle.runId,
    });
    const options =
      assigned?.task.publicTask.responseContract.kind === "CHOICE"
        ? assigned.task.publicTask.responseContract.options
        : [];
    const correct = options.find((option) =>
      assigned?.task.answerKey.correctOptionIds.includes(option.id),
    );
    expect(correct?.content.text).toBe("盘子");
    expect(options.map((option) => option.content.text)).not.toContain("板");
    screen = await submitChoice(controller, learningTasks, screen, true);
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    expect(screen.canHandoffToStrengthen).toBe(true);
    expect(screen.canHandoffToBuild).toBe(false);
    const stored = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(routingResultsForProbe(stored!.probe!).at(-1)).toMatchObject({
      target: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
      disposition: "STRENGTHEN",
    });
  });

  it("routes plate recall-wrong + recognition-wrong to BUILD only", async () => {
    const { controller, learningTasks, repository } = createMealLabHarness({
      beginAt: "PROBE",
    });
    let screen: ContextLabCurrentScreen = await reachPlateTask(
      controller,
      await controller.start(),
    );
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    screen = await submitChoice(controller, learningTasks, screen, false);
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    expect(screen.canHandoffToBuild).toBe(true);
    expect(screen.canHandoffToStrengthen).toBe(false);
    const stored = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(routingResultsForProbe(stored!.probe!).at(-1)).toMatchObject({
      target: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
      disposition: "BUILD",
    });
  });
});

describe("Meal Context Lab plate BUILD and STRENGTHEN frozen handoff", () => {
  it("reaches a frozen BUILD task for plate and does not write Evidence on guided steps", async () => {
    const { controller, learning, learningTasks } = createMealLabHarness({
      beginAt: "PROBE",
    });
    let screen: ContextLabCurrentScreen = await reachPlateTask(
      controller,
      await controller.start(),
    );
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    screen = await submitChoice(controller, learningTasks, screen, false);
    screen = await continueFrom(controller, screen);
    const evidenceAfterProbe = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    const summaryHandle = runHandle(screen);
    screen = await controller.continueProbe({
      runId: summaryHandle.runId,
      revision: summaryHandle.revision,
      intent: "START_BUILD",
    });
    if (screen.kind === "ERROR") {
      throw new Error(`${screen.code}: ${screen.message}`);
    }
    while (screen.kind === "GUIDED") {
      const before = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
      screen = await controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      });
      expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length).toBe(before);
    }
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    expect(screen.context.instruction).not.toMatch(/plate/i);
    expect(JSON.stringify(screen.task.prompt)).not.toMatch(/plate/i);
    const issuedTaskId = screen.task.id;
    const first = await submitTyping(controller, screen, "plate");
    const afterFirst = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    expect(afterFirst).toBeGreaterThan(evidenceAfterProbe);
    assertKind(first, "FROZEN_TASK_RECORDED");
    await controller.submitFrozenTask({
      runId: first.handle.runId,
      revision: first.handle.revision,
      taskId: issuedTaskId,
      action: { kind: "TEXT_INPUT", value: "plate" },
    });
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length).toBe(afterFirst);
  });

  it("writes one INCORRECT Evidence for a wrong plate BUILD frozen task", async () => {
    const { controller, learning, learningTasks } = createMealLabHarness({
      beginAt: "PROBE",
    });
    let screen: ContextLabCurrentScreen = await reachPlateTask(
      controller,
      await controller.start(),
    );
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    screen = await submitChoice(controller, learningTasks, screen, false);
    screen = await continueFrom(controller, screen);
    const summaryHandle = runHandle(screen);
    screen = await controller.continueProbe({
      runId: summaryHandle.runId,
      revision: summaryHandle.revision,
      intent: "START_BUILD",
    });
    if (screen.kind === "ERROR") {
      throw new Error(`${screen.code}: ${screen.message}`);
    }
    screen = await walkGuidedToFrozen(controller, screen);
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    const before = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    const recorded = await submitTyping(controller, screen, "bowl");
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    const items = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID);
    expect(items.length).toBe(before + 1);
    expect(items.at(-1)?.outcome).toBe("INCORRECT");
  });

  it("reaches a frozen STRENGTHEN task for plate without duplicate Evidence on refresh", async () => {
    const { controller, learning, learningTasks } = createMealLabHarness({
      beginAt: "PROBE",
    });
    let screen: ContextLabCurrentScreen = await reachPlateTask(
      controller,
      await controller.start(),
    );
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    screen = await submitChoice(controller, learningTasks, screen, true);
    screen = await continueFrom(controller, screen);
    const strengthenHandle = runHandle(screen);
    screen = await controller.continueProbe({
      runId: strengthenHandle.runId,
      revision: strengthenHandle.revision,
      intent: "START_STRENGTHEN",
    });
    if (screen.kind === "ERROR") {
      throw new Error(`${screen.code}: ${screen.message}`);
    }
    screen = await walkGuidedToFrozen(controller, screen);
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    const recorded = await submitTyping(controller, screen, "plate");
    const count = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    const refreshed = await controller.loadCurrent({
      runId: recorded.handle.runId,
    });
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length).toBe(count);
    expect(refreshed.kind).not.toBe("ERROR");
  });
});
