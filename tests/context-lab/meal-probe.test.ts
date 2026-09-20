import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { serializeContextLabRunState } from "@/server/context-lab/context-lab-run-state";
import { routingResultsForProbe } from "@/server/context-lab/meal-probe-orchestration";
import {
  collectKeys,
  createMealLabHarness,
  FORBIDDEN_CLIENT_FIELDS,
} from "./helpers";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import type { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import type { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import type { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";

const OTHER_USER = "00000000-0000-4000-8000-000000000099";
const LEMMAS = ["soup", "bowl", "spoon", "fork"] as const;

function probeHarness() {
  return createMealLabHarness({ beginAt: "PROBE" });
}

function assertKind<K extends ContextLabCurrentScreen["kind"]>(
  screen: ContextLabCurrentScreen,
  kind: K,
): asserts screen is Extract<ContextLabCurrentScreen, { kind: K }> {
  if (screen.kind !== kind) {
    throw new Error(`expected ${kind}, got ${screen.kind}`);
  }
}

async function issueCurrentTask(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  assertKind(screen, "PROBE_INTRO");
  return controller.continueProbe({
    runId: screen.handle.runId,
    revision: screen.handle.revision,
  });
}

async function continueFrom(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  if (
    screen.kind !== "PROBE_INTRO" &&
    screen.kind !== "FROZEN_TASK_RECORDED" &&
    screen.kind !== "PROBE_SUMMARY"
  ) {
    throw new Error(`cannot continue from ${screen.kind}`);
  }
  return controller.continueProbe({
    runId: screen.handle.runId,
    revision: screen.handle.revision,
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

function visibleProbeText(screen: ContextLabCurrentScreen): string {
  if (screen.kind === "ERROR") {
    return `${screen.title} ${screen.message}`;
  }
  const parts: string[] = [];
  if ("context" in screen) {
    parts.push(
      screen.context.title,
      screen.context.settingLabel,
      screen.context.instruction,
      ...screen.context.entities.map((entity) => entity.label),
      screen.context.relationCaption ?? "",
      ...(screen.context.contrastCaptions ?? []).map((item) => item.caption),
    );
  }
  if (screen.kind === "FROZEN_TASK_PREVIEW") {
    const prompt = screen.task.prompt;
    if (prompt.kind === "MEANING_TEXT" || prompt.kind === "LEXEME_TEXT") {
      parts.push(prompt.text);
    }
    if (screen.task.responseContract.kind === "CHOICE") {
      parts.push(
        ...screen.task.responseContract.options.map((option) => option.content.text),
      );
    }
  }
  if (screen.kind === "PROBE_SUMMARY") {
    parts.push(...screen.items.map((item) => `${item.label}${item.summary}`));
  }
  return parts.join("\n");
}

function evidenceCount(learning: InMemoryLearningRepository) {
  return learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
}

describe("Meal cold Probe orchestration", () => {
  it("starts with a Probe intro and does not leak teaching contrast", async () => {
    const { controller } = probeHarness();
    const screen = await controller.start();
    assertKind(screen, "PROBE_INTRO");
    expect(screen.context.instruction).toContain("教学还没开始");
    expect(JSON.stringify(screen)).not.toContain("勺子 → 适合舀汤");
    expect(visibleProbeText(screen)).not.toMatch(/spoon|fork|soup|bowl|\/spuːn\//i);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(collectKeys(screen).has(field)).toBe(false);
    }
  });

  it("issues only the first Probe task and hides future tasks", async () => {
    const { controller } = probeHarness();
    const intro = await controller.start();
    const first = await issueCurrentTask(controller, intro);
    assertKind(first, "FROZEN_TASK_PREVIEW");
    expect(first.task.responseContract.kind).toBe("CHOICE");
    expect(first.progress).toEqual({ current: 1, total: 4, unit: "个物品" });
    expect(first.task.prompt.kind === "MEANING_TEXT" ? first.task.prompt.text : "").toBe(
      "这个物品对应哪个意思？",
    );
    expect(visibleProbeText(first)).not.toMatch(/spoon|fork|soup|bowl|\/spuːn\//i);
    expect(collectKeys(first).has("targets")).toBe(false);
    expect(collectKeys(first).has("observations")).toBe(false);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(collectKeys(first).has(field)).toBe(false);
    }
  });

  it("writes one Evidence through submitTaskAction and ignores a duplicate submit", async () => {
    const { controller, learningTasks, learning } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    assertKind(first, "FROZEN_TASK_PREVIEW");
    const recorded = await submitChoice(controller, learningTasks, first, false);
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    expect(evidenceCount(learning)).toBe(1);
    const duplicate = await controller.submitFrozenTask({
      runId: first.handle.runId,
      revision: first.handle.revision,
      taskId: first.task.id,
      action: { kind: "CHOICE", optionId: "00000000-0000-4000-8000-000000000001" },
    });
    expect(duplicate.kind).toBe("ERROR");
    expect(duplicate.kind === "ERROR" ? duplicate.code : "").toBe(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN,
    );
    const retrySameTask = await controller.submitFrozenTask({
      runId: recorded.handle.runId,
      revision: recorded.handle.revision,
      taskId: first.task.id,
      action: { kind: "CHOICE", optionId: "00000000-0000-4000-8000-000000000001" },
    });
    expect(retrySameTask.kind).toBe("FROZEN_TASK_RECORDED");
    expect(evidenceCount(learning)).toBe(1);
  });

  it("rejects a stale revision and treats a foreign run like a missing run", async () => {
    const { controller, learningTasks } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    assertKind(first, "FROZEN_TASK_PREVIEW");
    const stale = await controller.submitFrozenTask({
      runId: first.handle.runId,
      revision: first.handle.revision - 1,
      taskId: first.task.id,
      action: { kind: "CHOICE", optionId: (await choiceIds(learningTasks, first.task.id)).wrong },
    });
    expect(stale.kind).toBe("ERROR");
    expect(stale.kind === "ERROR" ? stale.code : "").toBe(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN,
    );

    const foreign = createMealLabHarness({
      beginAt: "PROBE",
      userId: OTHER_USER,
    });
    const missing = await foreign.controller.submitFrozenTask({
      runId: first.handle.runId,
      revision: first.handle.revision,
      taskId: first.task.id,
      action: { kind: "CHOICE", optionId: "option" },
    });
    const unknown = await controller.submitFrozenTask({
      runId: "00000000-0000-4000-8000-000000000404",
      revision: 0,
      taskId: first.task.id,
      action: { kind: "CHOICE", optionId: "option" },
    });
    expect(missing.kind).toBe("ERROR");
    expect(unknown.kind).toBe("ERROR");
    expect(missing.kind === "ERROR" ? missing.code : "").toBe(
      unknown.kind === "ERROR" ? unknown.code : "",
    );
  });

  it("skips recall after a failed recognition and enters recall after an independent recognition", async () => {
    const { controller, learningTasks } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    const failed = await submitChoice(controller, learningTasks, first, false);
    const second = await continueFrom(controller, failed);
    assertKind(second, "FROZEN_TASK_PREVIEW");
    expect(second.progress.current).toBe(2);
    expect(second.task.responseContract.kind).toBe("CHOICE");

    const { controller: readyController, learningTasks: readyTasks } = probeHarness();
    const readyFirst = await issueCurrentTask(readyController, await readyController.start());
    const recognized = await submitChoice(readyController, readyTasks, readyFirst, true);
    const recall = await continueFrom(readyController, recognized);
    assertKind(recall, "FROZEN_TASK_PREVIEW");
    expect(recall.progress.current).toBe(1);
    expect(recall.task.responseContract.kind).toBe("TEXT_INPUT");
    expect(recall.task.prompt.kind === "MEANING_TEXT" ? recall.task.prompt.text : "").toBe(
      "写出这个物品的英文单词",
    );
  });

  it("produces four public routing results without AnswerKey or Evidence internals", async () => {
    const { controller, learningTasks, repository } = probeHarness();
    let screen: ContextLabCurrentScreen = await controller.start();
    for (let index = 0; index < 4; index += 1) {
      screen = await continueFrom(controller, screen);
      screen = await submitChoice(controller, learningTasks, screen, false);
    }
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    expect(screen.items).toHaveLength(4);
    expect(screen.items.map((item) => item.label)).toEqual(["汤", "碗", "勺子", "叉子"]);
    expect(screen.items.every((item) => item.summary === "建立情境记忆")).toBe(true);
    expect(screen.canHandoffToBuild).toBe(true);
    expect(JSON.stringify(screen)).not.toContain("BUILD");
    expect(JSON.stringify(screen)).not.toContain("INDEPENDENT_CORRECT");
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(collectKeys(screen).has(field)).toBe(false);
    }

    const stored = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.probe).toBeTruthy();
    const results = routingResultsForProbe(stored!.probe!);
    expect(results).toHaveLength(4);
    expect(results.every((result) => result.disposition === "BUILD")).toBe(true);
    const json = JSON.stringify(
      serializeContextLabRunState({
        experienceRun: stored!.experienceRun,
        probe: stored!.probe,
      }),
    );
    expect(json).not.toContain("answerKey");
    expect(json).not.toContain("exactAcceptedTexts");
    expect(json).not.toContain("typedAnswer");
    expect(json).not.toContain("expectedAnswer");
    expect(json).not.toContain("StudentLexemeModel");
  });

  it("hands off only spoon BUILD to the existing teaching path", async () => {
    const { controller, learningTasks } = probeHarness();
    let screen: ContextLabCurrentScreen = await controller.start();
    for (let index = 0; index < 4; index += 1) {
      screen = await continueFrom(controller, screen);
      screen = await submitChoice(controller, learningTasks, screen, false);
    }
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    const teaching = await controller.continueProbe({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      handoff: true,
    });
    assertKind(teaching, "GUIDED");
    expect(teaching.context.settingLabel).toContain("教学阶段");
    expect(teaching.teachingPhase).toBe(true);

    const { controller: readyController, learningTasks: readyTasks } = probeHarness();
    let ready: ContextLabCurrentScreen = await readyController.start();
    for (const lemma of LEMMAS) {
      ready = await continueFrom(readyController, ready);
      ready = await submitChoice(readyController, readyTasks, ready, true);
      ready = await continueFrom(readyController, ready);
      ready = await submitTyping(readyController, ready, lemma);
    }
    ready = await continueFrom(readyController, ready);
    assertKind(ready, "PROBE_SUMMARY");
    expect(ready.items.every((item) => item.summary === "本次已能独立回答")).toBe(true);
    expect(ready.canHandoffToBuild).toBe(false);
    const refused = await readyController.continueProbe({
      runId: ready.handle.runId,
      revision: ready.handle.revision,
      handoff: true,
    });
    expect(refused.kind).toBe("ERROR");
  });

  it("routes independent recognition + failed recall to STRENGTHEN and does not fake a handoff", async () => {
    const { controller, learningTasks } = probeHarness();
    let screen: ContextLabCurrentScreen = await controller.start();
    screen = await continueFrom(controller, screen);
    screen = await submitChoice(controller, learningTasks, screen, true);
    screen = await continueFrom(controller, screen);
    screen = await submitTyping(controller, screen, "nope");
    for (let index = 0; index < 3; index += 1) {
      screen = await continueFrom(controller, screen);
      screen = await submitChoice(controller, learningTasks, screen, false);
    }
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    expect(screen.items[0]?.summary).toBe("加强记忆连接");
    expect(screen.items.slice(1).every((item) => item.summary === "建立情境记忆")).toBe(
      true,
    );
    expect(screen.canHandoffToBuild).toBe(true);

    const { controller: spoonController, learningTasks: spoonTasks } = probeHarness();
    let spoonScreen: ContextLabCurrentScreen = await spoonController.start();
    for (let index = 0; index < 2; index += 1) {
      spoonScreen = await continueFrom(spoonController, spoonScreen);
      spoonScreen = await submitChoice(spoonController, spoonTasks, spoonScreen, false);
    }
    spoonScreen = await continueFrom(spoonController, spoonScreen);
    spoonScreen = await submitChoice(spoonController, spoonTasks, spoonScreen, true);
    spoonScreen = await continueFrom(spoonController, spoonScreen);
    spoonScreen = await submitTyping(spoonController, spoonScreen, "nope");
    spoonScreen = await continueFrom(spoonController, spoonScreen);
    spoonScreen = await submitChoice(spoonController, spoonTasks, spoonScreen, false);
    spoonScreen = await continueFrom(spoonController, spoonScreen);
    assertKind(spoonScreen, "PROBE_SUMMARY");
    expect(spoonScreen.items[2]?.summary).toBe("加强记忆连接");
    expect(spoonScreen.canHandoffToBuild).toBe(false);
    expect(spoonScreen.pendingMessage).toContain("强化体验将在下一步实现");
    const noHandoff = await spoonController.continueProbe({
      runId: spoonScreen.handle.runId,
      revision: spoonScreen.handle.revision,
      handoff: true,
    });
    expect(noHandoff.kind).toBe("ERROR");
  });

  it("does not accept a client-supplied next target or disposition", async () => {
    const { controller } = probeHarness();
    const intro = await controller.start();
    assertKind(intro, "PROBE_INTRO");
    const skipped = await controller.submitFrozenTask({
      runId: intro.handle.runId,
      revision: intro.handle.revision,
      taskId: "not-issued",
      action: { kind: "CHOICE", optionId: "x" },
    });
    expect(skipped.kind).toBe("ERROR");
    const extra = await controller.submitFrozenTask({
      runId: intro.handle.runId,
      revision: intro.handle.revision,
      taskId: "not-issued",
      action: { kind: "CHOICE", optionId: "x" },
      ...({ disposition: "BUILD", userId: "attacker" } as object),
    } as never);
    expect(extra.kind).toBe("ERROR");
  });

  it("refresh convention is a new experimental run, not probe restore", async () => {
    const { controller, learningTasks } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    assertKind(first, "FROZEN_TASK_PREVIEW");
    await submitChoice(controller, learningTasks, first, false);
    const again = await controller.start();
    assertKind(again, "PROBE_INTRO");
    expect(again.handle.runId).not.toBe(first.handle.runId);
    expect(again.progress.current).toBe(0);
  });

  it("keeps READY from being treated as a mastery write", async () => {
    const result = {
      disposition: "READY",
      reason: "PROBE_INDEPENDENT_RECOGNITION_AND_RECALL",
    };
    expect(result.reason).not.toMatch(/mastery/i);
    expect(EvidenceOutcome.INDEPENDENT_CORRECT).toBe("INDEPENDENT_CORRECT");
  });
});
