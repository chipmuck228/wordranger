import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import {
  collectKeys,
  createMealLabHarness,
  FORBIDDEN_CLIENT_FIELDS,
} from "./helpers";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import type { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import type { ContextLabRunRecord } from "@/server/context-lab/context-lab-run.types";
import type { InMemoryContextLabRunRepository } from "@/server/context-lab/in-memory-context-lab-run-repository";
import type { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";

function assertKind<K extends ContextLabCurrentScreen["kind"]>(
  screen: ContextLabCurrentScreen,
  kind: K,
): asserts screen is Extract<ContextLabCurrentScreen, { kind: K }> {
  if (screen.kind !== kind) {
    throw new Error(`expected ${kind}, got ${screen.kind}`);
  }
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

async function continueFrom(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  if (
    screen.kind !== "PROBE_INTRO" &&
    screen.kind !== "PROBE_TASK_RECORDED" &&
    screen.kind !== "PROBE_SUMMARY" &&
    screen.kind !== "FROZEN_TASK_RECORDED"
  ) {
    throw new Error(`cannot continue from ${screen.kind}`);
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

const FOUR_TARGETS = [
  {
    lemma: "soup",
    label: "汤",
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.soup),
  },
  {
    lemma: "bowl",
    label: "碗",
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.bowl),
  },
  {
    lemma: "spoon",
    label: "勺子",
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.spoon),
  },
  {
    lemma: "fork",
    label: "叉子",
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.fork),
  },
] as const;

async function reachSummary(
  controller: MealContextLabController,
  learningTasks: InMemoryLearningTaskRepository,
  recognitionCorrect: readonly boolean[],
) {
  const readyLemmas = ["soup", "bowl", "spoon", "fork", "cup", "plate"] as const;
  let screen: ContextLabCurrentScreen = await controller.start();
  for (let index = 0; index < readyLemmas.length; index += 1) {
    screen = await continueFrom(controller, screen);
    if (index >= recognitionCorrect.length) {
      screen = await submitTyping(controller, screen, readyLemmas[index]!);
      continue;
    }
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    screen = await submitChoice(
      controller,
      learningTasks,
      screen,
      recognitionCorrect[index] ?? false,
    );
  }
  screen = await continueFrom(controller, screen);
  assertKind(screen, "PROBE_SUMMARY");
  return screen;
}

async function walkBuildToPreview(
  controller: MealContextLabController,
  ground: ContextLabCurrentScreen,
  lemma: string,
) {
  assertKind(ground, "GUIDED");
  expect(ground.buildPhase).toBe("GROUND");
  let current: ContextLabCurrentScreen = ground;
  for (let index = 0; index < 4; index += 1) {
    current = await controller.acknowledge({
      runId: current.handle.runId,
      revision: current.handle.revision,
      activityId: current.kind === "GUIDED" ? current.activity.id : "",
    });
    assertKind(current, "GUIDED");
  }
  expect(current.buildPhase).toBe("FADE");
  const verify = await controller.acknowledge({
    runId: current.handle.runId,
    revision: current.handle.revision,
    activityId: current.activity.id,
  });
  assertKind(verify, "FROZEN_TASK_PREVIEW");
  expect(verify.context.supportReveal).toBeUndefined();
  expect(verify.context.instruction).not.toMatch(new RegExp(lemma, "i"));
  return {
    fade: current,
    verify,
  };
}

async function walkBuildItem(
  controller: MealContextLabController,
  ground: ContextLabCurrentScreen,
  lemma: string,
) {
  const preview = await walkBuildToPreview(controller, ground, lemma);
  return {
    ...preview,
    recorded: await submitTyping(controller, preview.verify, lemma),
  };
}

describe("Meal four-target BUILD queue", () => {
  it.each(FOUR_TARGETS)("can build $lemma from the catalog-driven plan", async (target) => {
    const { controller, learningTasks, learning } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const recognition = FOUR_TARGETS.map((item) => item.lemma !== target.lemma);
    const summary = await reachSummary(controller, learningTasks, recognition);
    expect(summary.canHandoffToBuild).toBe(true);
    const ground = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
    });
    assertKind(ground, "GUIDED");
    expect(ground.context.title).toBe(`建立${target.label}的情境记忆`);
    expect(ground.context.supportReveal).toBeUndefined();
    const walked = await walkBuildItem(controller, ground, target.lemma);
    assertKind(walked.recorded, "FROZEN_TASK_RECORDED");
    expect(walked.recorded.recordedMessage).toBe(`“${target.label}”的这次建立已记录。`);
    expect(walked.verify.task.lexemeId).toBe(target.lexemeId);
    const evidence = learning
      .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
      .find((item) => item.taskId === walked.verify.task.id);
    expect(evidence?.lexemeId).toBe(target.lexemeId);
    expect(evidence?.hintCount).toBe(0);
    expect(evidence?.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(collectKeys(walked.verify).has(field)).toBe(false);
    }
  });

  it("queues two BUILD targets in scene order and refuses client index selection", async () => {
    const { controller, learningTasks, learning } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSummary(controller, learningTasks, [
      false,
      true,
      true,
      false,
    ]);
    expect(summary.buildButtonLabel).toBe("开始建立 2 个词");
    expect(summary.canHandoffToStrengthen).toBe(true);
    const skipped = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
      queueIndex: 1,
    } as never);
    expect(skipped.kind).toBe("ERROR");

    const soup = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
    });
    assertKind(soup, "GUIDED");
    expect(soup.context.title).toBe("建立汤的情境记忆");
    const first = await walkBuildItem(controller, soup, "soup");
    assertKind(first.recorded, "FROZEN_TASK_RECORDED");
    expect(first.recorded.continueLabel).toBe("继续下一个");

    const stale = await controller.continueProbe({
      runId: first.recorded.handle.runId,
      revision: first.recorded.handle.revision - 1,
    });
    expect(stale.kind === "ERROR" ? stale.code : "").toBe(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN,
    );

    const fork = await controller.continueProbe({
      runId: first.recorded.handle.runId,
      revision: first.recorded.handle.revision,
    });
    assertKind(fork, "GUIDED");
    expect(fork.context.title).toBe("建立叉子的情境记忆");
    const second = await walkBuildItem(controller, fork, "fork");
    assertKind(second.recorded, "FROZEN_TASK_RECORDED");
    expect(second.recorded.queueCompleteMessage).toBe("本次需要建立的词已经完成。");
    expect(second.recorded.continueLabel).toBe("回到这次检查");
    expect(
      learning
        .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
        .filter((item) => {
          const taskId = item.taskId;
          return (
            taskId !== null &&
            [first.verify.task.id, second.verify.task.id].includes(taskId)
          );
        })
        .map((item) => item.lexemeId),
    ).toEqual([FOUR_TARGETS[0].lexemeId, FOUR_TARGETS[3].lexemeId]);

    const summaryAgain = await controller.continueProbe({
      runId: second.recorded.handle.runId,
      revision: second.recorded.handle.revision,
    });
    assertKind(summaryAgain, "PROBE_SUMMARY");
    expect(summaryAgain.canHandoffToBuild).toBe(false);
    expect(summaryAgain.canHandoffToStrengthen).toBe(true);
    const refused = await controller.continueProbe({
      runId: summaryAgain.handle.runId,
      revision: summaryAgain.handle.revision,
      intent: "START_BUILD",
    });
    expect(refused.kind).toBe("ERROR");
  });

  it("rejects a persisted queue whose currentPlanId does not match the run", async () => {
    const { controller, learningTasks, repository } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSummary(controller, learningTasks, [
      false,
      false,
      false,
      false,
    ]);
    const ground = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
    });
    assertKind(ground, "GUIDED");
    const stored = await repository.get({
      runId: ground.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.probe?.buildQueue?.currentPlanId).toBe(
      stored?.experienceRun.planSnapshot.plan.id,
    );
    stored!.probe!.buildQueue = {
      ...stored!.probe!.buildQueue!,
      currentPlanId: "other-plan",
    };
    await repository.saveIfRevision({
      runId: stored!.id,
      userId: V1_PLACEHOLDER_USER_ID,
      expectedRevision: stored!.revision,
      nextRun: stored!.experienceRun,
      nextProbe: stored!.probe,
      updatedAt: "2026-09-20T00:00:01.000Z",
    });
    const loaded = await controller.loadCurrent({ runId: ground.handle.runId });
    expect(loaded.kind).toBe("ERROR");
  });

  it("restores the current BUILD step through loadCurrent", async () => {
    const { controller, learningTasks } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSummary(controller, learningTasks, [
      false,
      false,
      false,
      false,
    ]);
    const ground = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
    });
    assertKind(ground, "GUIDED");
    const connect = await controller.acknowledge({
      runId: ground.handle.runId,
      revision: ground.handle.revision,
      activityId: ground.activity.id,
    });
    assertKind(connect, "GUIDED");
    expect(connect.buildPhase).toBe("CONNECT");
    const loaded = await controller.loadCurrent({ runId: connect.handle.runId });
    assertKind(loaded, "GUIDED");
    expect(loaded.buildPhase).toBe("CONNECT");
    expect(loaded.context.title).toBe("建立汤的情境记忆");
    expect(loaded.handle.runId).toBe(connect.handle.runId);
  });

  it("rejects client-chosen target, hintCount, planId, and disposition", async () => {
    const { controller, learningTasks } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSummary(controller, learningTasks, [
      false,
      true,
      true,
      false,
    ]);
    for (const extra of [
      { hintCount: 1 },
      { userId: V1_PLACEHOLDER_USER_ID },
      { planId: "plan-1" },
      { disposition: "STRENGTHEN" },
      { targetId: FOUR_TARGETS[3].lexemeId },
    ]) {
      const rejected = await controller.continueProbe({
        runId: summary.handle.runId,
        revision: summary.handle.revision,
        intent: "START_BUILD",
        ...extra,
      } as never);
      expect(rejected.kind).toBe("ERROR");
    }

    const soup = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
    });
    const walked = await walkBuildItem(controller, soup, "soup");
    const hinted = await controller.submitFrozenTask({
      runId: walked.verify.handle.runId,
      revision: walked.verify.handle.revision,
      taskId: walked.verify.task.id,
      action: { kind: "TEXT_INPUT", value: "soup" },
      hintCount: 2,
    } as never);
    expect(hinted.kind).toBe("ERROR");
  });

  it("rejects acknowledge, submit, and continue on a corrupted queue without loadCurrent", async () => {
    const { controller, learningTasks, repository, learning } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSummary(controller, learningTasks, [
      false,
      true,
      true,
      false,
    ]);
    const ground = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
    });
    assertKind(ground, "GUIDED");
    const afterPlanSwap = await persistProbeMutation(repository, ground.handle.runId, (record) => {
      record.probe!.buildQueue = {
        ...record.probe!.buildQueue!,
        currentPlanId: "other-plan",
      };
    });
    const acknowledged = await controller.acknowledge({
      runId: afterPlanSwap.id,
      revision: afterPlanSwap.revision,
      activityId: ground.activity.id,
    });
    expect(acknowledged.kind).toBe("ERROR");
    expect(acknowledged.kind === "ERROR" ? acknowledged.code : "").toContain(
      "BUILD_QUEUE_PLAN_MISMATCH",
    );
    expect(
      (await repository.get({ runId: afterPlanSwap.id, userId: V1_PLACEHOLDER_USER_ID }))
        ?.revision,
    ).toBe(afterPlanSwap.revision);

    const restoredPlan = await persistProbeMutation(repository, ground.handle.runId, (record) => {
      record.probe!.buildQueue = {
        ...record.probe!.buildQueue!,
        currentPlanId: record.experienceRun.planSnapshot.plan.id,
      };
    });
    const preview = await walkBuildToPreview(
      controller,
      {
        ...ground,
        handle: { runId: restoredPlan.id, revision: restoredPlan.revision },
      },
      "soup",
    );
    const beforeEvidence = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    const afterSubmitSwap = await persistProbeMutation(
      repository,
      preview.verify.handle.runId,
      (record) => {
        record.probe!.buildQueue = {
          ...record.probe!.buildQueue!,
          currentPlanId: "other-plan",
        };
      },
    );
    const submitted = await controller.submitFrozenTask({
      runId: afterSubmitSwap.id,
      revision: afterSubmitSwap.revision,
      taskId: preview.verify.task.id,
      action: { kind: "TEXT_INPUT", value: "soup" },
    });
    expect(submitted.kind).toBe("ERROR");
    expect(submitted.kind === "ERROR" ? submitted.code : "").toContain(
      "BUILD_QUEUE_PLAN_MISMATCH",
    );
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(
      beforeEvidence,
    );
  });

  it("does not continue a recorded BUILD queue that still has a currentPlanId", async () => {
    const { controller, learningTasks, repository } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSummary(controller, learningTasks, [
      false,
      true,
      true,
      false,
    ]);
    const soup = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
    });
    const first = await walkBuildItem(controller, soup, "soup");
    assertKind(first.recorded, "FROZEN_TASK_RECORDED");
    const corrupted = await persistProbeMutation(
      repository,
      first.recorded.handle.runId,
      (record) => {
        record.probe!.buildQueue = {
          ...record.probe!.buildQueue!,
          currentPlanId: "stale-plan",
        };
      },
    );
    const continued = await controller.continueProbe({
      runId: corrupted.id,
      revision: corrupted.revision,
    });
    expect(continued.kind).toBe("ERROR");
    expect(continued.kind === "ERROR" ? continued.code : "").toContain(
      "BUILD_QUEUE_PHASE_INVARIANT",
    );
    const latest = await repository.get({
      runId: corrupted.id,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(latest?.probe?.phase).toBe("BUILD_ITEM_RECORDED");
    expect(latest?.probe?.buildQueue?.currentIndex).toBe(1);
  });

  it("rejects START_BUILD from ROUTING_SUMMARY when a queue still has an active plan", async () => {
    const { controller, learningTasks, repository } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSummary(controller, learningTasks, [
      false,
      false,
      false,
      false,
    ]);
    const ground = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
    });
    assertKind(ground, "GUIDED");
    const corrupted = await persistProbeMutation(repository, ground.handle.runId, (record) => {
      record.probe!.phase = "ROUTING_SUMMARY";
    });
    const restarted = await controller.continueProbe({
      runId: corrupted.id,
      revision: corrupted.revision,
      intent: "START_BUILD",
    });
    expect(restarted.kind).toBe("ERROR");
    expect(restarted.kind === "ERROR" ? restarted.code : "").toContain(
      "ACTIVE_PLAN_ID_NOT_ALLOWED",
    );
  });
});

async function persistProbeMutation(
  repository: InMemoryContextLabRunRepository,
  runId: string,
  mutate: (record: ContextLabRunRecord) => void,
): Promise<ContextLabRunRecord> {
  const stored = await repository.get({
    runId,
    userId: V1_PLACEHOLDER_USER_ID,
  });
  if (!stored?.probe) {
    throw new Error("missing probe");
  }
  mutate(stored);
  const saved = await repository.saveIfRevision({
    runId: stored.id,
    userId: V1_PLACEHOLDER_USER_ID,
    expectedRevision: stored.revision,
    nextRun: stored.experienceRun,
    nextProbe: stored.probe,
    updatedAt: "2026-09-20T00:00:01.000Z",
  });
  if (!saved.ok) {
    throw new Error(saved.reason);
  }
  const latest = await repository.get({
    runId,
    userId: V1_PLACEHOLDER_USER_ID,
  });
  if (!latest) {
    throw new Error("missing after mutation");
  }
  return latest;
}
