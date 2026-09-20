import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { CONTEXT_LAB_FROZEN_RENDERER_GAME_ID } from "@/server/context-lab/context-lab-frozen-renderer";
import { serializeContextLabRunState } from "@/server/context-lab/context-lab-run-state";
import { BUNDLED_SPOON_LEXEME_ID } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import {
  collectKeys,
  createMealLabHarness,
  FORBIDDEN_CLIENT_FIELDS,
} from "./helpers";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import type { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import type { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";

const OTHER_USER = "00000000-0000-4000-8000-000000000099";

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

async function continueFrom(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  if (
    screen.kind !== "PROBE_INTRO" &&
    screen.kind !== "PROBE_TASK_RECORDED" &&
    screen.kind !== "PROBE_SUMMARY"
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
  const ids = await choiceIds(learningTasks, screen.task.id);
  return controller.submitFrozenTask({
    runId: screen.handle.runId,
    revision: screen.handle.revision,
    taskId: screen.task.id,
    action: { kind: "CHOICE", optionId: correct ? ids.correct : ids.wrong },
  });
}

async function reachSpoonStrengthenSummary(
  controller: MealContextLabController,
  learningTasks: InMemoryLearningTaskRepository,
) {
  let screen: ContextLabCurrentScreen = await controller.start();
  const recognitionCorrect = [false, false, true, false];
  for (let index = 0; index < 4; index += 1) {
    screen = await continueFrom(controller, screen);
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    screen = await submitChoice(
      controller,
      learningTasks,
      screen,
      recognitionCorrect[index],
    );
  }
  screen = await continueFrom(controller, screen);
  assertKind(screen, "PROBE_SUMMARY");
  return screen;
}

async function enterStrengthen(
  controller: MealContextLabController,
  learningTasks: InMemoryLearningTaskRepository,
) {
  const summary = await reachSpoonStrengthenSummary(controller, learningTasks);
  const reconnect = await controller.continueProbe({
    runId: summary.handle.runId,
    revision: summary.handle.revision,
    handoff: true,
  });
  assertKind(reconnect, "GUIDED");
  return reconnect;
}

describe("Meal spoon active-recall STRENGTHEN", () => {
  it("hands off only spoon STRENGTHEN into the recall-strengthen plan", async () => {
    const { controller, learningTasks } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSpoonStrengthenSummary(controller, learningTasks);
    expect(summary.canHandoffToStrengthen).toBe(true);
    expect(summary.canHandoffToBuild).toBe(false);
    const reconnect = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      handoff: true,
    });
    assertKind(reconnect, "GUIDED");
    expect(reconnect.strengthenPhase).toBe("RECONNECT");
    expect(reconnect.activity.kind).toBe("RECONNECT_FORM");
    expect(reconnect.context.supportReveal?.lexicalForm).toBe("spoon");
    expect(reconnect.context.supportReveal?.meaningGloss).toBe("匙，调羹");
    expect(reconnect.context.relationCaption).toBeUndefined();
    expect(reconnect.context.contrastCaptions).toBeUndefined();
    expect(JSON.stringify(reconnect)).not.toContain("教学阶段");
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(collectKeys(reconnect).has(field)).toBe(false);
    }
    expect(collectKeys(reconnect).has("hintCount")).toBe(false);
  });

  it("records support exposures, fades the form, then verifies with assisted Evidence", async () => {
    const { controller, learningTasks, learning, repository } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const reconnect = await enterStrengthen(controller, learningTasks);
    const afterReconnect = await repository.get({
      runId: reconnect.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(afterReconnect?.probe?.supportExposures).toHaveLength(0);

    const fade = await controller.acknowledge({
      runId: reconnect.handle.runId,
      revision: reconnect.handle.revision,
      activityId: reconnect.activity.id,
    });
    assertKind(fade, "GUIDED");
    expect(fade.strengthenPhase).toBe("FADE");
    expect(fade.acknowledgeLabel).toBe("试着自己写");
    expect(fade.context.supportReveal?.spellingCue).toBe("s _ _ _ _");
    expect(fade.context.supportReveal?.lexicalForm).toBeUndefined();
    expect(fade.context.supportReveal?.spellingCue).toBe("s _ _ _ _");
    expect(fade.context.entities.some((entity) => entity.label === "勺子")).toBe(true);

    const storedFade = await repository.get({
      runId: fade.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(storedFade?.probe?.supportExposures?.map((item) => item.kind)).toEqual([
      "LEXICAL_FORM",
      "MEANING_GLOSS",
    ]);
    expect(JSON.stringify(storedFade?.probe?.supportExposures)).not.toContain(
      "answerKey",
    );

    const duplicateAck = await controller.acknowledge({
      runId: reconnect.handle.runId,
      revision: reconnect.handle.revision,
      activityId: reconnect.activity.id,
    });
    expect(duplicateAck.kind).toBe("ERROR");
    const afterDuplicate = await repository.get({
      runId: fade.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(afterDuplicate?.probe?.supportExposures).toHaveLength(2);

    const verify = await controller.acknowledge({
      runId: fade.handle.runId,
      revision: fade.handle.revision,
      activityId: fade.activity.id,
    });
    assertKind(verify, "FROZEN_TASK_PREVIEW");
    expect(verify.strengthenPhase).toBe("VERIFY");
    expect(verify.task.targetSkill).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(verify.task.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
    expect(verify.task.promptMode).toBe(PromptMode.MEANING_TO_WORD);
    expect(verify.task.answerMode).toBe(AnswerMode.TYPING);
    expect(verify.task.lexemeId).toBe(BUNDLED_SPOON_LEXEME_ID);
    expect(verify.context.supportReveal).toBeUndefined();
    expect(verify.context.instruction).not.toMatch(/spoon|s _ _ _ _/i);
    expect(JSON.stringify(verify.task)).not.toMatch(/\bspoon\b/);
    expect(JSON.stringify(verify)).not.toContain("s _ _ _ _");
    expect(collectKeys(verify).has("answerKey")).toBe(false);
    expect(collectKeys(verify).has("hintCount")).toBe(false);

    const assigned = await learningTasks.getTaskForEvaluation(verify.task.id);
    expect(assigned?.task.answerKey.targetLexemeId).toBe(BUNDLED_SPOON_LEXEME_ID);

    const clientHint = await controller.submitFrozenTask({
      runId: verify.handle.runId,
      revision: verify.handle.revision,
      taskId: verify.task.id,
      action: { kind: "TEXT_INPUT", value: "spoon" },
      hintCount: 0,
    } as never);
    expect(clientHint.kind).toBe("ERROR");

    const recorded = await submitTyping(controller, verify, "spoon");
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    expect(recorded.feedback.status).toBe("ASSISTED");
    expect(recorded.feedback.message).toBe("这次是在提示后答对的。");
    expect(recorded.recordedMessage).toBe("这次强化已经记录。");
    expect(recorded.feedback.message).not.toMatch(/完全独立|永久掌握/);

    const items = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID);
    const verifyEvidence = items.find((item) => item.taskId === verify.task.id);
    expect(verifyEvidence?.outcome).toBe(EvidenceOutcome.ASSISTED_CORRECT);
    expect(verifyEvidence?.lexemeId).toBe(BUNDLED_SPOON_LEXEME_ID);
    expect(verifyEvidence?.gameId).toBe(CONTEXT_LAB_FROZEN_RENDERER_GAME_ID);
    expect(verifyEvidence?.hintCount).toBeGreaterThan(0);
    expect(verifyEvidence?.sessionId).toBe(verify.handle.runId);

    const duplicate = await submitTyping(controller, verify, "spoon");
    assertKind(duplicate, "FROZEN_TASK_RECORDED");
    expect(
      learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).filter(
        (item) => item.taskId === verify.task.id,
      ),
    ).toHaveLength(1);
  });

  it("records INCORRECT strengthen verification without inventing Candidate mastery", async () => {
    const { controller, learningTasks, learning } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const reconnect = await enterStrengthen(controller, learningTasks);
    const fade = await controller.acknowledge({
      runId: reconnect.handle.runId,
      revision: reconnect.handle.revision,
      activityId: reconnect.activity.id,
    });
    assertKind(fade, "GUIDED");
    const verify = await controller.acknowledge({
      runId: fade.handle.runId,
      revision: fade.handle.revision,
      activityId: fade.activity.id,
    });
    assertKind(verify, "FROZEN_TASK_PREVIEW");
    const recorded = await submitTyping(controller, verify, "fork");
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    expect(recorded.feedback.status).toBe("INCORRECT");
    expect(recorded.recordedMessage).toBe("这次强化已经记录。");
    const verifyEvidence = learning
      .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
      .find((item) => item.taskId === verify.task.id);
    expect(verifyEvidence?.outcome).toBe(EvidenceOutcome.INCORRECT);
  });

  it("restores the current strengthen step through loadCurrent", async () => {
    const { controller, learningTasks } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const reconnect = await enterStrengthen(controller, learningTasks);
    const fade = await controller.acknowledge({
      runId: reconnect.handle.runId,
      revision: reconnect.handle.revision,
      activityId: reconnect.activity.id,
    });
    assertKind(fade, "GUIDED");
    const loaded = await controller.loadCurrent({ runId: fade.handle.runId });
    assertKind(loaded, "GUIDED");
    expect(loaded.strengthenPhase).toBe("FADE");
    expect(loaded.handle.runId).toBe(fade.handle.runId);
  });

  it("keeps BUILD happy path free of strengthen support exposure", async () => {
    const { controller, learningTasks, repository, learning } = createMealLabHarness({
      beginAt: "PROBE",
    });
    let screen: ContextLabCurrentScreen = await controller.start();
    for (let index = 0; index < 4; index += 1) {
      screen = await continueFrom(controller, screen);
      screen = await submitTyping(controller, screen, "nope");
      screen = await continueFrom(controller, screen);
      screen = await submitChoice(controller, learningTasks, screen, false);
    }
    screen = await continueFrom(controller, screen);
    assertKind(screen, "PROBE_SUMMARY");
    expect(screen.canHandoffToBuild).toBe(true);
    expect(screen.canHandoffToStrengthen).toBe(false);
    const teaching = await controller.continueProbe({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      handoff: true,
    });
    assertKind(teaching, "GUIDED");
    expect(teaching.context.settingLabel).toContain("教学阶段");
    const stored = await repository.get({
      runId: teaching.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.probe?.experienceMode).toBe("BUILD");
    expect(stored?.probe?.supportExposures ?? []).toEqual([]);
    expect(stored?.experienceRun.planSnapshot.plan.mode).toBe("BUILD");

    let current: ContextLabCurrentScreen = teaching;
    current = await controller.acknowledge({
      runId: teaching.handle.runId,
      revision: teaching.handle.revision,
      activityId: teaching.activity.id,
    });
    assertKind(current, "GUIDED");
    const second = current;
    current = await controller.acknowledge({
      runId: second.handle.runId,
      revision: second.handle.revision,
      activityId: second.activity.id,
    });
    assertKind(current, "GUIDED");
    const preview = await controller.acknowledge({
      runId: current.handle.runId,
      revision: current.handle.revision,
      activityId: current.activity.id,
    });
    assertKind(preview, "FROZEN_TASK_PREVIEW");
    const before = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    const recorded = await submitTyping(controller, preview, "spoon");
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    expect(recorded.feedback.status).toBe("CORRECT");
    expect(recorded.recordedMessage).toBe("这次练习已记录。");
    const buildEvidence = learning
      .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
      .find((item) => item.taskId === preview.task.id);
    expect(buildEvidence?.hintCount).toBe(0);
    expect(buildEvidence?.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length).toBe(
      before + 1,
    );
  });

  it("round-trips strengthen mode and exposures without AnswerKey or Evidence copies", async () => {
    const { controller, learningTasks, repository } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const reconnect = await enterStrengthen(controller, learningTasks);
    await controller.acknowledge({
      runId: reconnect.handle.runId,
      revision: reconnect.handle.revision,
      activityId: reconnect.activity.id,
    });
    const stored = await repository.get({
      runId: reconnect.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    const json = JSON.stringify(
      serializeContextLabRunState({
        experienceRun: stored!.experienceRun,
        probe: stored!.probe,
      }),
    );
    expect(stored?.probe?.phase).toBe("STRENGTHEN_HANDOFF");
    expect(stored?.probe?.experienceMode).toBe("STRENGTHEN");
    expect(stored?.probe?.supportExposures?.length).toBeGreaterThan(0);
    expect(json).not.toContain("answerKey");
    expect(json).not.toContain("exactAcceptedTexts");
    expect(json).not.toContain("LearningEvidence");

    const stale = await controller.acknowledge({
      runId: reconnect.handle.runId,
      revision: reconnect.handle.revision,
      activityId: reconnect.activity.id,
    });
    expect(stale.kind === "ERROR" ? stale.code : "").toBe(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN,
    );

    const foreign = createMealLabHarness({
      beginAt: "PROBE",
      userId: OTHER_USER,
    });
    const missing = await foreign.controller.loadCurrent({
      runId: reconnect.handle.runId,
    });
    expect(missing.kind === "ERROR" ? missing.code : "").toBe(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_NOT_FOUND,
    );
  });
});
