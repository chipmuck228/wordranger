import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { serializeContextLabRunState } from "@/server/context-lab/context-lab-run-state";
import { nextProbeSkill, routingResultsForProbe } from "@/server/context-lab/meal-probe-orchestration";
import {
  collectKeys,
  createMealLabHarness,
  FORBIDDEN_CLIENT_FIELDS,
} from "./helpers";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import type { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import type { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import type { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";

const OTHER_USER = "00000000-0000-4000-8000-000000000099";
const LEMMAS = ["soup", "bowl", "spoon", "fork", "cup", "plate"] as const;

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
  if (screen.kind === "PROBE_TASK_RECORDED") {
    parts.push(screen.message);
  }
  return parts.join("\n");
}

function evidenceCount(learning: InMemoryLearningRepository) {
  return learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
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
    screen.kind !== "PROBE_TASK_RECORDED" &&
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

describe("Meal cold Probe orchestration", () => {
  it("starts with a Probe intro and does not leak teaching contrast", async () => {
    const { controller } = probeHarness();
    const screen = await controller.start();
    assertKind(screen, "PROBE_INTRO");
    expect(screen.context.instruction).toContain("教学还没开始");
    expect(screen.context.instruction).toContain("辅助物品");
    expect(screen.context.instruction).toContain("6 个目标词");
    expect(screen.progress).toEqual({ current: 0, total: 6, unit: "个目标词" });
    expect(screen.context.instruction).not.toMatch(/entity|frame-only|Probe target/i);
    expect(JSON.stringify(screen)).not.toContain("勺子 → 适合舀汤");
    expect(visibleProbeText(screen)).not.toMatch(/spoon|fork|soup|bowl|\/spuːn\//i);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(collectKeys(screen).has(field)).toBe(false);
    }
  });

  it("issues active recall first with a scene-safe public payload", async () => {
    const { controller } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    assertKind(first, "FROZEN_TASK_PREVIEW");
    expect(first.presentationMode).toBe("SCENE_TARGET");
    expect(first.task.targetSkill).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(first.task.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
    expect(first.task.promptMode).toBe(PromptMode.MEANING_TO_WORD);
    expect(first.task.answerMode).toBe(AnswerMode.TYPING);
    expect(first.task.responseContract.kind).toBe("TEXT_INPUT");
    expect(first.task.prompt).toEqual({
      kind: "MEANING_TEXT",
      text: "写出当前物品的英文单词",
    });
    expect(first.progress.current).toBe(1);
    expect(first.progress.total).toBe(6);
    expect(first.progress.unit).toBe("个目标词");
    expect(visibleProbeText(first)).not.toMatch(/\bsoup\b|\bbowl\b|\bspoon\b|\bfork\b|\bcup\b|\bplate\b/i);
    expect(collectKeys(first).has("targets")).toBe(false);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(collectKeys(first).has(field)).toBe(false);
    }
  });

  it("records Probe submissions without public outcome or correction", async () => {
    const { controller, learning } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    const recorded = await submitTyping(controller, first, "nope");
    assertKind(recorded, "PROBE_TASK_RECORDED");
    expect(recorded.message).toBe("这次回答已记录，请继续。");
    expect(JSON.stringify(recorded)).not.toContain("CORRECT");
    expect(JSON.stringify(recorded)).not.toContain("INCORRECT");
    expect(JSON.stringify(recorded)).not.toContain("ASSISTED");
    expect(JSON.stringify(recorded)).not.toContain("答对了");
    expect(JSON.stringify(recorded)).not.toContain("soup");
    expect(collectKeys(recorded).has("feedback")).toBe(false);
    expect(collectKeys(recorded).has("correction")).toBe(false);
    expect(collectKeys(recorded).has("evidenceId")).toBe(false);
    expect(evidenceCount(learning)).toBe(1);
  });

  it("issues recognition only after a non-independent recall and keeps English LEXEME_TEXT", async () => {
    const { controller, learningTasks } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    const recorded = await submitTyping(controller, first, "nope");
    const recognition = await continueFrom(controller, recorded);
    assertKind(recognition, "FROZEN_TASK_PREVIEW");
    expect(recognition.presentationMode).toBe("TASK_ONLY");
    expect(recognition.task.targetSkill).toBe(VocabularySkill.MEANING_RECOGNITION);
    expect(recognition.task.taskType).toBe(LearningTaskType.MEANING_CHOICE);
    expect(recognition.task.promptMode).toBe(PromptMode.WORD_TO_MEANING);
    expect(recognition.task.answerMode).toBe(AnswerMode.MULTIPLE_CHOICE);
    expect(recognition.task.prompt).toEqual({ kind: "LEXEME_TEXT", text: "soup" });
    expect(recognition.context.entities).toEqual([]);
    expect(recognition.context.entities.some((entity) => entity.label === "汤")).toBe(
      false,
    );
    const assigned = await learningTasks.getTaskForEvaluation(recognition.task.id);
    expect(assigned?.task.publicTask.lexemeId).toBe(
      assigned?.task.answerKey.targetLexemeId,
    );
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(collectKeys(recognition).has(field)).toBe(false);
    }
  });

  it("skips recognition after independent recall and moves to the next target", async () => {
    const { controller } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    const recorded = await submitTyping(controller, first, "soup");
    const second = await continueFrom(controller, recorded);
    assertKind(second, "FROZEN_TASK_PREVIEW");
    expect(second.progress.current).toBe(2);
    expect(second.task.responseContract.kind).toBe("TEXT_INPUT");
    expect(second.task.prompt.kind === "MEANING_TEXT" ? second.task.prompt.text : "").toBe(
      "写出当前物品的英文单词",
    );
  });

  it("writes one Evidence and rejects stale, foreign, and client-chosen next skill", async () => {
    const { controller, learning } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    assertKind(first, "FROZEN_TASK_PREVIEW");
    const recorded = await submitTyping(controller, first, "nope");
    assertKind(recorded, "PROBE_TASK_RECORDED");
    expect(evidenceCount(learning)).toBe(1);
    const stale = await controller.submitFrozenTask({
      runId: first.handle.runId,
      revision: first.handle.revision,
      taskId: first.task.id,
      action: { kind: "TEXT_INPUT", value: "again" },
    });
    expect(stale.kind === "ERROR" ? stale.code : "").toBe(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN,
    );
    const retry = await controller.submitFrozenTask({
      runId: recorded.handle.runId,
      revision: recorded.handle.revision,
      taskId: first.task.id,
      action: { kind: "TEXT_INPUT", value: "again" },
    });
    expect(retry.kind).toBe("PROBE_TASK_RECORDED");
    expect(evidenceCount(learning)).toBe(1);

    const foreign = createMealLabHarness({ beginAt: "PROBE", userId: OTHER_USER });
    const missing = await foreign.controller.submitFrozenTask({
      runId: first.handle.runId,
      revision: first.handle.revision,
      taskId: first.task.id,
      action: { kind: "TEXT_INPUT", value: "x" },
    });
    const unknown = await controller.submitFrozenTask({
      runId: "00000000-0000-4000-8000-000000000404",
      revision: 0,
      taskId: first.task.id,
      action: { kind: "TEXT_INPUT", value: "x" },
    });
    expect(missing.kind === "ERROR" ? missing.code : "").toBe(
      unknown.kind === "ERROR" ? unknown.code : "",
    );
  });

  it("produces six routing results and hands off BUILD after all-wrong Probe", async () => {
    const { controller, learningTasks, repository } = probeHarness();
    let screen: ContextLabCurrentScreen = await controller.start();
    for (let index = 0; index < 6; index += 1) {
      screen = await continueFrom(controller, screen);
      screen = await submitTyping(controller, screen, "nope");
      screen = await continueFrom(controller, screen);
      screen = await submitChoice(controller, learningTasks, screen, false);
    }
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    expect(screen.items).toHaveLength(6);
    expect(screen.items.every((item) => item.summary === "建立情境记忆")).toBe(true);
    expect(screen.canHandoffToBuild).toBe(true);
    expect(screen.canHandoffToStrengthen).toBe(false);
    expect(JSON.stringify(screen)).not.toContain("answerKey");
    expect(JSON.stringify(screen)).not.toContain(EvidenceOutcome.INCORRECT);

    const stored = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(routingResultsForProbe(stored!.probe!)).toHaveLength(6);
    const json = JSON.stringify(
      serializeContextLabRunState({
        experienceRun: stored!.experienceRun,
        probe: stored!.probe,
      }),
    );
    expect(json).not.toContain("answerKey");
    expect(json).not.toContain("exactAcceptedTexts");

    const teaching = await controller.continueProbe({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      intent: "START_BUILD",
    });
    assertKind(teaching, "GUIDED");
    expect(teaching.context.settingLabel).toContain("教学阶段");
  });

  it("routes independent recall to READY and does not hand off BUILD", async () => {
    const { controller } = probeHarness();
    let screen: ContextLabCurrentScreen = await controller.start();
    for (const lemma of LEMMAS) {
      screen = await continueFrom(controller, screen);
      screen = await submitTyping(controller, screen, lemma);
    }
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    expect(screen.items.every((item) => item.summary === "本次已能独立回答")).toBe(true);
    expect(screen.canHandoffToBuild).toBe(false);
    expect(screen.canHandoffToStrengthen).toBe(false);
    const refused = await controller.continueProbe({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      intent: "START_BUILD",
    });
    expect(refused.kind).toBe("ERROR");
  });

  it("routes failed recall + correct recognition to STRENGTHEN and offers spoon strengthen handoff", async () => {
    const { controller, learningTasks } = probeHarness();
    let screen: ContextLabCurrentScreen = await controller.start();
    for (let index = 0; index < 2; index += 1) {
      screen = await continueFrom(controller, screen);
      screen = await submitTyping(controller, screen, "nope");
      screen = await continueFrom(controller, screen);
      screen = await submitChoice(controller, learningTasks, screen, false);
    }
    screen = await continueFrom(controller, screen);
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    screen = await submitChoice(controller, learningTasks, screen, true);
    screen = await continueFrom(controller, screen);
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    screen = await submitChoice(controller, learningTasks, screen, false);
    screen = await continueFrom(controller, screen);
    screen = await submitTyping(controller, screen, "cup");
    screen = await continueFrom(controller, screen);
    screen = await submitTyping(controller, screen, "plate");
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    expect(screen.items[2]?.summary).toBe("加强记忆连接");
    expect(screen.canHandoffToBuild).toBe(true);
    expect(screen.canHandoffToStrengthen).toBe(true);
    expect(screen.pendingMessage).toBeNull();
    const strengthen = await controller.continueProbe({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      intent: "START_STRENGTHEN",
    });
    assertKind(strengthen, "GUIDED");
    expect(strengthen.strengthenPhase).toBe("RECONNECT");
    expect(strengthen.context.settingLabel).toContain("强化阶段");
    expect(strengthen.context.settingLabel).not.toContain("教学阶段");
  });

  it("does not accept a client-supplied next skill or disposition", async () => {
    const { controller } = probeHarness();
    const intro = await controller.start();
    assertKind(intro, "PROBE_INTRO");
    const skipped = await controller.submitFrozenTask({
      runId: intro.handle.runId,
      revision: intro.handle.revision,
      taskId: "not-issued",
      action: { kind: "TEXT_INPUT", value: "soup" },
    });
    expect(skipped.kind).toBe("ERROR");
  });

  it("refresh convention is a new experimental run", async () => {
    const { controller } = probeHarness();
    const first = await issueCurrentTask(controller, await controller.start());
    assertKind(first, "FROZEN_TASK_PREVIEW");
    await submitTyping(controller, first, "nope");
    const again = await controller.start();
    assertKind(again, "PROBE_INTRO");
    expect(again.handle.runId).not.toBe(first.handle.runId);
  });

  it("keeps BUILD recorded feedback for the teaching path", async () => {
    const { controller } = createMealLabHarness({ beginAt: "BUILD" });
    let screen: ContextLabCurrentScreen = await controller.start();
    for (let index = 0; index < 5; index += 1) {
      if (screen.kind !== "GUIDED") {
        throw new Error("guided");
      }
      screen = await controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      });
    }
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    const recorded = await controller.submitFrozenTask({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      taskId: screen.task.id,
      action: { kind: "TEXT_INPUT", value: "soup" },
    });
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    expect(recorded.feedback.status).toBe("CORRECT");
  });
});

describe("nextProbeSkill", () => {
  it("always starts a target on ACTIVE_RECALL", () => {
    const next = nextProbeSkill({
      phase: "PROBE_INTRO",
      targets: [
        {
          target: { lexemeId: "a", senseId: "a#1" },
          sceneClusterId: "meal",
          roleId: "FOOD",
          entityId: "home-soup",
          displayLabel: "汤",
          probeSkills: ["MEANING_RECOGNITION", "ACTIVE_RECALL"],
        },
      ],
      currentTargetIndex: 0,
      currentSkill: null,
      issued: null,
      observations: [],
    });
    expect(next).toEqual({ targetIndex: 0, skill: "ACTIVE_RECALL" });
  });
});
