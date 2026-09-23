import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET } from "@/contextual-learning/candidate-v0/content";
import { routingResultsForProbe } from "@/server/context-lab/meal-probe-orchestration";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import type { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import type { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import {
  createNineWordLabHarness,
  publishSyntheticNineWordRelease,
} from "./batch-03-release-helpers";

const READY_BEFORE_KNIFE = ["soup", "bowl", "spoon", "fork", "cup", "plate"] as const;

function assertKind<K extends ContextLabCurrentScreen["kind"]>(
  screen: ContextLabCurrentScreen,
  kind: K,
): asserts screen is Extract<ContextLabCurrentScreen, { kind: K }> {
  if (screen.kind !== kind) {
    throw new Error(`expected ${kind}, got ${screen.kind}`);
  }
}

async function continueFrom(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  if (screen.kind === "ERROR") {
    throw new Error(`${screen.code}: ${screen.message}`);
  }
  return controller.continueProbe({
    runId: screen.handle.runId,
    revision: screen.handle.revision,
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
) {
  const assigned = await learningTasks.getTaskForEvaluation(taskId);
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
  const ids = await choiceIds(learningTasks, screen.task.id);
  return controller.submitFrozenTask({
    runId: screen.handle.runId,
    revision: screen.handle.revision,
    taskId: screen.task.id,
    action: { kind: "CHOICE", optionId: correct ? ids.correct : ids.wrong },
  });
}

async function walkReady(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
  lemmas: readonly string[],
) {
  let current = screen;
  for (const lemma of lemmas) {
    if (current.kind !== "FROZEN_TASK_PREVIEW") {
      current = await continueFrom(controller, current);
    }
    current = await submitTyping(controller, current, lemma);
    current = await continueFrom(controller, current);
  }
  return current;
}

async function reachKnifeRecall() {
  const { releases } = await publishSyntheticNineWordRelease();
  const harness = createNineWordLabHarness(releases);
  let screen = await walkReady(
    harness.controller,
    await harness.controller.start(),
    READY_BEFORE_KNIFE,
  );
  if (screen.kind !== "FROZEN_TASK_PREVIEW") {
    screen = await continueFrom(harness.controller, screen);
  }
  assertKind(screen, "FROZEN_TASK_PREVIEW");
  return { ...harness, screen };
}

async function walkGuidedToFrozen(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  const observed: ContextLabCurrentScreen[] = [];
  let current = screen;
  while (current.kind === "GUIDED") {
    observed.push(current);
    current = await controller.acknowledge({
      runId: current.handle.runId,
      revision: current.handle.revision,
      activityId: current.activity.id,
    });
  }
  return { observed, screen: current };
}

describe("Context Lab knife lexical-form projection", () => {
  it("accepts Probe typing knife and rejects the annotated lemma", async () => {
    const outcomes: Array<{ value: string; outcome: string }> = [];
    for (const value of ["knife", "knife(pl.knives)", "knives"] as const) {
      const { controller, learning, screen } = await reachKnifeRecall();
      const recorded = await submitTyping(controller, screen, value);
      assertKind(recorded, "PROBE_TASK_RECORDED");
      const evidence = learning
        .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
        .find((item) => item.taskId === screen.task.id);
      outcomes.push({ value, outcome: evidence?.outcome ?? "MISSING" });
    }
    expect(outcomes).toEqual([
      { value: "knife", outcome: EvidenceOutcome.INDEPENDENT_CORRECT },
      { value: "knife(pl.knives)", outcome: EvidenceOutcome.INCORRECT },
      { value: "knives", outcome: EvidenceOutcome.INCORRECT },
    ]);
  });

  it("shows knife, not the plural annotation, on BUILD Guided and frozen verify", async () => {
    const { controller, learning, learningTasks, repository, screen } =
      await reachKnifeRecall();
    let current = await submitTyping(controller, screen, "nope");
    current = await continueFrom(controller, current);
    current = await submitChoice(controller, learningTasks, current, false);
    current = await continueFrom(controller, current);
    current = await walkReady(controller, current, ["bread", "water"]);
    if (current.kind !== "PROBE_SUMMARY") {
      current = await continueFrom(controller, current);
    }
    assertKind(current, "PROBE_SUMMARY");
    const stored = await repository.get({
      runId: current.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(
      routingResultsForProbe(stored!.probe!).find(
        (item) => item.target.senseId === MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET.senseId,
      )?.disposition,
    ).toBe("BUILD");

    current = await controller.continueProbe({
      runId: current.handle.runId,
      revision: current.handle.revision,
      intent: "START_BUILD",
    });
    const walked = await walkGuidedToFrozen(controller, current);
    const teach = walked.observed.find((item) => item.kind === "GUIDED" && item.buildPhase === "TEACH");
    const fade = walked.observed.find((item) => item.kind === "GUIDED" && item.buildPhase === "FADE");
    assertKind(teach!, "GUIDED");
    assertKind(fade!, "GUIDED");
    expect(teach.context.supportReveal?.lexicalForm).toBe("knife");
    expect(teach.context.supportReveal?.inflectionNote).toBe("复数 knives");
    expect(JSON.stringify(teach)).not.toContain("knife(pl.knives)");
    expect(fade.context.supportReveal?.spellingCue).toBe("k _ _ _ _");

    assertKind(walked.screen, "FROZEN_TASK_PREVIEW");
    const verify = walked.screen;
    const before = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    const recorded = await submitTyping(controller, verify, "knife");
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    const evidence = learning
      .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
      .find((item) => item.taskId === verify.task.id);
    expect(evidence?.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length).toBe(before + 1);
    await controller.submitFrozenTask({
      runId: recorded.handle.runId,
      revision: recorded.handle.revision,
      taskId: verify.task.id,
      action: { kind: "TEXT_INPUT", value: "knife" },
    });
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length).toBe(before + 1);
    expect(stored?.releaseId).toBe(recorded.handle.contentReleaseId);
  });

  it("keeps BUILD frozen verification on the projected answer form", async () => {
    const outcomes: Array<{ value: string; outcome: string }> = [];
    for (const value of ["knife", "knife(pl.knives)", "knives"] as const) {
      const { controller, learning, learningTasks, screen } = await reachKnifeRecall();
      let current = await submitTyping(controller, screen, "nope");
      current = await continueFrom(controller, current);
      current = await submitChoice(controller, learningTasks, current, false);
      current = await continueFrom(controller, current);
      current = await walkReady(controller, current, ["bread", "water"]);
      if (current.kind !== "PROBE_SUMMARY") {
        current = await continueFrom(controller, current);
      }
      assertKind(current, "PROBE_SUMMARY");
      current = await controller.continueProbe({
        runId: current.handle.runId,
        revision: current.handle.revision,
        intent: "START_BUILD",
      });
      const walked = await walkGuidedToFrozen(controller, current);
      assertKind(walked.screen, "FROZEN_TASK_PREVIEW");
      const verify = walked.screen;
      await submitTyping(controller, verify, value);
      const evidence = learning
        .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
        .find((item) => item.taskId === verify.task.id);
      outcomes.push({ value, outcome: evidence?.outcome ?? "MISSING" });
    }
    expect(outcomes).toEqual([
      { value: "knife", outcome: EvidenceOutcome.INDEPENDENT_CORRECT },
      { value: "knife(pl.knives)", outcome: EvidenceOutcome.INCORRECT },
      { value: "knives", outcome: EvidenceOutcome.INCORRECT },
    ]);
  });

  it("shows the projected knife form when STRENGTHEN is routed", async () => {
    const { controller, learning, learningTasks, repository, screen } =
      await reachKnifeRecall();
    let current = await submitTyping(controller, screen, "nope");
    current = await continueFrom(controller, current);
    current = await submitChoice(controller, learningTasks, current, true);
    current = await continueFrom(controller, current);
    current = await walkReady(controller, current, ["bread", "water"]);
    if (current.kind !== "PROBE_SUMMARY") {
      current = await continueFrom(controller, current);
    }
    assertKind(current, "PROBE_SUMMARY");
    const stored = await repository.get({
      runId: current.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(
      routingResultsForProbe(stored!.probe!).find(
        (item) => item.target.senseId === MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET.senseId,
      )?.disposition,
    ).toBe("STRENGTHEN");

    current = await controller.continueProbe({
      runId: current.handle.runId,
      revision: current.handle.revision,
      intent: "START_STRENGTHEN",
    });
    const walked = await walkGuidedToFrozen(controller, current);
    const reconnect = walked.observed.find(
      (item) => item.kind === "GUIDED" && item.strengthenPhase === "RECONNECT",
    );
    const fade = walked.observed.find(
      (item) => item.kind === "GUIDED" && item.strengthenPhase === "FADE",
    );
    assertKind(reconnect!, "GUIDED");
    assertKind(fade!, "GUIDED");
    expect(reconnect.context.supportReveal?.lexicalForm).toBe("knife");
    expect(reconnect.context.supportReveal?.inflectionNote).toBe("复数 knives");
    expect(JSON.stringify(reconnect)).not.toContain("knife(pl.knives)");
    expect(fade.context.supportReveal?.spellingCue).toBe("k _ _ _ _");

    assertKind(walked.screen, "FROZEN_TASK_PREVIEW");
    const verify = walked.screen;
    await submitTyping(controller, verify, "knife");
    const evidence = learning
      .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
      .find((item) => item.taskId === verify.task.id);
    expect(evidence?.outcome).toBe(EvidenceOutcome.ASSISTED_CORRECT);
  });
});
