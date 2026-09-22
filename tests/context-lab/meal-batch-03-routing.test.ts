import { describe, expect, it } from "vitest";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import {
  MEAL_SCENE_EXPANSION_BATCH_03_BREAD_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_03_WATER_TARGET,
} from "@/contextual-learning/candidate-v0/content";
import { BUNDLED_LEXEME_BINDINGS } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { routingResultsForProbe } from "@/server/context-lab/meal-probe-orchestration";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import type { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import type { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { collectKeys, FORBIDDEN_CLIENT_FIELDS } from "./helpers";
import {
  createNineWordLabHarness,
  publishSyntheticNineWordRelease,
} from "./batch-03-release-helpers";

const READY_BEFORE_KNIFE = ["soup", "bowl", "spoon", "fork", "cup", "plate"] as const;
const KNIFE_FORM =
  bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.knife.canonicalKey)?.display ??
  "knife(pl.knives)";
const BREAD_FORM =
  bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.bread.canonicalKey)?.display ?? "bread";
const WATER_FORM =
  bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.water.canonicalKey)?.display ?? "water";

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
    texts: assigned.task.publicTask.responseContract.options.map(
      (option) => option.content.text,
    ),
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

describe("Meal Context Lab nine-word active-release routing", () => {
  it("starts Probe intro with nine targets and does not leak internals", async () => {
    const { releases, published } = await publishSyntheticNineWordRelease();
    const { controller } = createNineWordLabHarness(releases);
    const screen = await controller.start();
    expect(screen.kind).toBe("PROBE_INTRO");
    assertKind(screen, "PROBE_INTRO");
    expect(screen.progress.total).toBe(9);
    expect(JSON.stringify(screen)).not.toContain("PLAN_NO_COMPATIBLE_VARIANT");
    expect(screen.handle.contentReleaseId).toBe(published.releaseId);
    const keys = collectKeys(screen);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
    expect(keys.has("humanDecision")).toBe(false);
    expect(keys.has("approvalBasis")).toBe(false);
    expect(keys.has("reviewKey")).toBe(false);
    expect(keys.has("futureTargets")).toBe(false);
    expect(JSON.stringify(screen)).not.toContain("HUMAN_REVIEW_PROMOTION");
    expect(JSON.stringify(screen)).not.toContain("knife#eating-tool");
    expect(JSON.stringify(screen)).not.toContain("bread#solid-food");
    expect(JSON.stringify(screen)).not.toContain("water#drinkable-liquid");
  });

  it("routes knife recall-wrong + recognition-wrong to BUILD, walks Guided, and reaches frozen verification", async () => {
    const { releases } = await publishSyntheticNineWordRelease();
    const { controller, learning, learningTasks, repository } =
      createNineWordLabHarness(releases);
    let screen = await walkReady(controller, await controller.start(), READY_BEFORE_KNIFE);
    if (screen.kind !== "FROZEN_TASK_PREVIEW") {
      screen = await continueFrom(controller, screen);
    }
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    const recognition = await choiceIds(learningTasks, screen.task.id);
    expect(recognition.texts).toContain("小刀");
    expect(recognition.texts).not.toContain("勺子");
    screen = await submitChoice(controller, learningTasks, screen, false);
    screen = await continueFrom(controller, screen);
    screen = await walkReady(controller, screen, [BREAD_FORM, WATER_FORM]);
    if (screen.kind !== "PROBE_SUMMARY") {
      screen = await continueFrom(controller, screen);
    }
    assertKind(screen, "PROBE_SUMMARY");
    const stored = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(
      routingResultsForProbe(stored!.probe!).find(
        (item) => item.target.senseId === MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET.senseId,
      ),
    ).toMatchObject({
      target: MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET,
      disposition: "BUILD",
    });
    const evidenceAfterProbe = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    screen = await controller.continueProbe({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      intent: "START_BUILD",
    });
    if (screen.kind === "ERROR") {
      throw new Error(`${screen.code}: ${screen.message}`);
    }
    while (screen.kind === "GUIDED") {
      const before = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
      expect(screen.context.entities.some((item) => item.id === "home-knife")).toBe(true);
      if (screen.context.highlightedEntityIds.length > 0) {
        expect(screen.context.highlightedEntityIds).toContain("home-knife");
        expect(screen.context.highlightedEntityIds).not.toContain("home-spoon");
      }
      screen = await controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      });
      expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length).toBe(before);
    }
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    expect(JSON.stringify(screen.task.prompt)).not.toMatch(/knife|spoon/i);
    const issuedTaskId = screen.task.id;
    const first = await submitTyping(controller, screen, KNIFE_FORM);
    const afterFirst = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    expect(afterFirst).toBe(evidenceAfterProbe + 1);
    assertKind(first, "FROZEN_TASK_RECORDED");
    await controller.submitFrozenTask({
      runId: first.handle.runId,
      revision: first.handle.revision,
      taskId: issuedTaskId,
      action: { kind: "TEXT_INPUT", value: "knife" },
    });
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length).toBe(afterFirst);
  });

  it("routes bread recall-wrong + recognition-correct to STRENGTHEN and reaches frozen verification", async () => {
    const { releases } = await publishSyntheticNineWordRelease();
    const { controller, learning, learningTasks, repository } =
      createNineWordLabHarness(releases);
    let screen = await walkReady(controller, await controller.start(), [
      ...READY_BEFORE_KNIFE,
      KNIFE_FORM,
    ]);
    if (screen.kind !== "FROZEN_TASK_PREVIEW") {
      screen = await continueFrom(controller, screen);
    }
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    const recognition = await choiceIds(learningTasks, screen.task.id);
    expect(recognition.texts).toContain("面包");
    screen = await submitChoice(controller, learningTasks, screen, true);
    screen = await continueFrom(controller, screen);
    screen = await walkReady(controller, screen, [WATER_FORM]);
    if (screen.kind !== "PROBE_SUMMARY") {
      screen = await continueFrom(controller, screen);
    }
    assertKind(screen, "PROBE_SUMMARY");
    const stored = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(
      routingResultsForProbe(stored!.probe!).find(
        (item) => item.target.senseId === MEAL_SCENE_EXPANSION_BATCH_03_BREAD_TARGET.senseId,
      ),
    ).toMatchObject({
      target: MEAL_SCENE_EXPANSION_BATCH_03_BREAD_TARGET,
      disposition: "STRENGTHEN",
    });
    screen = await controller.continueProbe({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      intent: "START_STRENGTHEN",
    });
    if (screen.kind === "ERROR") {
      throw new Error(`${screen.code}: ${screen.message}`);
    }
    screen = await walkGuidedToFrozen(controller, screen);
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    const before = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    const recorded = await submitTyping(controller, screen, BREAD_FORM);
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length).toBe(before + 1);
  });

  it("routes independent water recall to READY and skips recognition and teaching", async () => {
    const { releases } = await publishSyntheticNineWordRelease();
    const { controller, repository } = createNineWordLabHarness(releases);
    let screen = await walkReady(controller, await controller.start(), [
      ...READY_BEFORE_KNIFE,
      KNIFE_FORM,
      BREAD_FORM,
    ]);
    if (screen.kind !== "FROZEN_TASK_PREVIEW") {
      screen = await continueFrom(controller, screen);
    }
    screen = await submitTyping(controller, screen, WATER_FORM);
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    const stored = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    const water = routingResultsForProbe(stored!.probe!).find(
      (item) => item.target.senseId === MEAL_SCENE_EXPANSION_BATCH_03_WATER_TARGET.senseId,
    );
    expect(water).toMatchObject({
      target: MEAL_SCENE_EXPANSION_BATCH_03_WATER_TARGET,
      disposition: "READY",
    });
    expect(water?.observations.map((item) => item.skill)).toEqual(["ACTIVE_RECALL"]);
    expect(screen.canHandoffToBuild).toBe(false);
    expect(screen.canHandoffToStrengthen).toBe(false);
    expect(JSON.stringify(screen)).not.toContain("GUIDED");
  });

  it("pins the published release on the run and later reads the pin, not a later pointer", async () => {
    const first = await publishSyntheticNineWordRelease();
    const { controller, repository } = createNineWordLabHarness(first.releases);
    const started = await controller.start();
    assertKind(started, "PROBE_INTRO");
    expect(started.handle.contentReleaseId).toBe(first.published.releaseId);
    const stored = await repository.get({
      runId: started.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.releaseId).toBe(first.published.releaseId);
    expect(stored?.releaseFingerprint).toBe(first.published.releaseFingerprint);

    first.releases.replacePointerRaw({
      ...first.pointer!,
      releaseFingerprint: "0".repeat(64),
    });
    const continued = await controller.continueProbe({
      runId: started.handle.runId,
      revision: started.handle.revision,
    });
    expect(continued.kind).not.toBe("ERROR");
    const after = await repository.get({
      runId: started.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(after?.releaseId).toBe(first.published.releaseId);
    expect(after?.releaseFingerprint).toBe(first.published.releaseFingerprint);

    const nextStart = await createNineWordLabHarness(first.releases).controller.start();
    expect(nextStart.kind).toBe("ERROR");
  });
});
