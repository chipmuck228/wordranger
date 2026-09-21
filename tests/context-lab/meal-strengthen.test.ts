import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { CONTEXT_LAB_FROZEN_RENDERER_GAME_ID } from "@/server/context-lab/context-lab-frozen-renderer";
import { serializeContextLabRunState } from "@/server/context-lab/context-lab-run-state";
import {
  BUNDLED_LEXEME_BINDINGS,
  BUNDLED_SPOON_LEXEME_ID,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
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
    intent: "START_STRENGTHEN",
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
    expect(summary.canHandoffToBuild).toBe(true);
    expect(summary.buildButtonLabel).toBe("开始建立 3 个词");
    const reconnect = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_STRENGTHEN",
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
    expect(recorded.recordedMessage).toBe("“勺子”的这次强化已记录。");
    expect(recorded.queueCompleteMessage).toBe("本次需要强化的词已经完成。");
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
    expect(recorded.recordedMessage).toBe("“勺子”的这次强化已记录。");
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
      intent: "START_BUILD",
    });
    assertKind(teaching, "GUIDED");
    expect(teaching.context.settingLabel).toContain("教学阶段");
    expect(teaching.context.title).toBe("建立汤的情境记忆");
    const stored = await repository.get({
      runId: teaching.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.probe?.experienceMode).toBe("BUILD");
    expect(stored?.probe?.supportExposures ?? []).toEqual([]);
    expect(stored?.experienceRun.planSnapshot.plan.mode).toBe("BUILD");

    let current: ContextLabCurrentScreen = teaching;
    for (let index = 0; index < 4; index += 1) {
      current = await controller.acknowledge({
        runId: current.handle.runId,
        revision: current.handle.revision,
        activityId: current.kind === "GUIDED" ? current.activity.id : "",
      });
      assertKind(current, "GUIDED");
    }
    const preview = await controller.acknowledge({
      runId: current.handle.runId,
      revision: current.handle.revision,
      activityId: current.activity.id,
    });
    assertKind(preview, "FROZEN_TASK_PREVIEW");
    const before = learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID).length;
    const recorded = await submitTyping(controller, preview, "soup");
    assertKind(recorded, "FROZEN_TASK_RECORDED");
    expect(recorded.feedback.status).toBe("CORRECT");
    expect(recorded.recordedMessage).toBe("“汤”的这次建立已记录。");
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

const FOUR_TARGETS = [
  {
    lemma: "soup",
    label: "汤",
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.soup),
    cue: "s _ _ _",
    gloss: "汤",
  },
  {
    lemma: "bowl",
    label: "碗",
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.bowl),
    cue: "b _ _ _",
    gloss: "碗",
  },
  {
    lemma: "spoon",
    label: "勺子",
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.spoon),
    cue: "s _ _ _ _",
    gloss: "匙，调羹",
  },
  {
    lemma: "fork",
    label: "叉子",
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.fork),
    cue: "f _ _ _",
    gloss: "叉",
  },
] as const;

async function reachSummary(
  controller: MealContextLabController,
  learningTasks: InMemoryLearningTaskRepository,
  recognitionCorrect: readonly boolean[],
) {
  let screen: ContextLabCurrentScreen = await controller.start();
  for (let index = 0; index < 4; index += 1) {
    screen = await continueFrom(controller, screen);
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

async function walkStrengthenItem(
  controller: MealContextLabController,
  reconnect: ContextLabCurrentScreen,
  lemma: string,
) {
  assertKind(reconnect, "GUIDED");
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
  return {
    fade,
    verify,
    recorded: await submitTyping(controller, verify, lemma),
  };
}

describe("Meal four-target active-recall STRENGTHEN", () => {
  it.each(FOUR_TARGETS)(
    "can strengthen $lemma from the catalog-driven plan",
    async (target) => {
      const { controller, learningTasks, learning } = createMealLabHarness({
        beginAt: "PROBE",
      });
      const recognition = FOUR_TARGETS.map((item) => item.lemma === target.lemma);
      const summary = await reachSummary(controller, learningTasks, recognition);
      expect(summary.canHandoffToStrengthen).toBe(true);
      expect(summary.strengthenButtonLabel).toBe("开始强化 1 个词");
      const reconnect = await controller.continueProbe({
        runId: summary.handle.runId,
        revision: summary.handle.revision,
        intent: "START_STRENGTHEN",
      });
      assertKind(reconnect, "GUIDED");
      expect(reconnect.context.title).toBe(`加强${target.label}的记忆连接`);
      expect(reconnect.context.supportReveal?.lexicalForm).toBe(target.lemma);
      expect(reconnect.context.supportReveal?.meaningGloss).toContain(target.gloss);
      expect(reconnect.context.highlightedEntityIds[0]).toContain(target.lemma === "spoon" ? "spoon" : target.lemma);
      const walked = await walkStrengthenItem(controller, reconnect, target.lemma);
      assertKind(walked.fade, "GUIDED");
      expect(walked.fade.context.supportReveal?.spellingCue).toBe(target.cue);
      expect(walked.verify.task.lexemeId).toBe(target.lexemeId);
      expect(walked.verify.context.supportReveal).toBeUndefined();
      expect(walked.verify.context.instruction).not.toMatch(new RegExp(target.lemma, "i"));
      assertKind(walked.recorded, "FROZEN_TASK_RECORDED");
      expect(walked.recorded.recordedMessage).toBe(`“${target.label}”的这次强化已记录。`);
      const evidence = learning
        .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
        .find((item) => item.taskId === walked.verify.task.id);
      expect(evidence?.outcome).toBe(EvidenceOutcome.ASSISTED_CORRECT);
      expect(evidence?.lexemeId).toBe(target.lexemeId);
      expect(evidence?.hintCount).toBeGreaterThan(0);
    },
  );

  it("queues two STRENGTHEN targets in scene order and refuses client target selection", async () => {
    const { controller, learningTasks, learning, repository } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSummary(controller, learningTasks, [
      true,
      true,
      false,
      false,
    ]);
    expect(summary.strengthenButtonLabel).toBe("开始强化 2 个词");
    expect(summary.canHandoffToBuild).toBe(true);
    expect(summary.items[1]?.capabilityNote).toBeUndefined();
    expect(summary.items[2]?.capabilityNote).toBeUndefined();
    expect(summary.items[3]?.capabilityNote).toBeUndefined();
    expect(summary.buildButtonLabel).toBe("开始建立 2 个词");
    const skipped = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_STRENGTHEN",
      targetId: summary.items[1]?.entityId,
    } as never);
    expect(skipped.kind).toBe("ERROR");

    const soup = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_STRENGTHEN",
    });
    assertKind(soup, "GUIDED");
    expect(soup.context.supportReveal?.lexicalForm).toBe("soup");
    const first = await walkStrengthenItem(controller, soup, "soup");
    assertKind(first.recorded, "FROZEN_TASK_RECORDED");
    expect(first.recorded.continueAvailable).toBe(true);
    expect(first.recorded.continueLabel).toBe("继续下一个");
    expect(first.verify.task.lexemeId).toBe(FOUR_TARGETS[0].lexemeId);

    const jump = await controller.continueProbe({
      runId: first.recorded.handle.runId,
      revision: first.recorded.handle.revision,
      intent: "START_STRENGTHEN",
    });
    expect(jump.kind).toBe("ERROR");

    const restored = await controller.loadCurrent({
      runId: first.recorded.handle.runId,
    });
    assertKind(restored, "FROZEN_TASK_RECORDED");
    expect(restored.recordedMessage).toContain("汤");

    const bowl = await controller.continueProbe({
      runId: first.recorded.handle.runId,
      revision: first.recorded.handle.revision,
    });
    assertKind(bowl, "GUIDED");
    expect(bowl.context.supportReveal?.lexicalForm).toBe("bowl");
    const second = await walkStrengthenItem(controller, bowl, "bowl");
    assertKind(second.recorded, "FROZEN_TASK_RECORDED");
    expect(second.recorded.queueCompleteMessage).toBe("本次需要强化的词已经完成。");
    expect(second.recorded.continueAvailable).toBe(true);
    expect(second.recorded.continueLabel).toBe("回到这次检查");
    expect(second.verify.task.lexemeId).toBe(FOUR_TARGETS[1].lexemeId);
    expect(
      learning
        .listEvidenceForUser(V1_PLACEHOLDER_USER_ID)
        .filter(
          (item) =>
            item.outcome === EvidenceOutcome.ASSISTED_CORRECT &&
            item.hintCount > 0 &&
            [FOUR_TARGETS[0].lexemeId, FOUR_TARGETS[1].lexemeId].includes(
              item.lexemeId,
            ),
        )
        .map((item) => item.lexemeId),
    ).toEqual([FOUR_TARGETS[0].lexemeId, FOUR_TARGETS[1].lexemeId]);

    const stored = await repository.get({
      runId: bowl.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.probe?.strengthenQueue?.completed).toHaveLength(2);
    const afterDone = await controller.continueProbe({
      runId: second.recorded.handle.runId,
      revision: second.recorded.handle.revision,
    });
    assertKind(afterDone, "PROBE_SUMMARY");
    expect(afterDone.canHandoffToStrengthen).toBe(false);
    expect(afterDone.canHandoffToBuild).toBe(true);
  });

  it("keeps mixed BUILD and STRENGTHEN as separate operations", async () => {
    const { controller, learningTasks } = createMealLabHarness({
      beginAt: "PROBE",
    });
    const summary = await reachSummary(controller, learningTasks, [
      true,
      false,
      false,
      false,
    ]);
    expect(summary.canHandoffToStrengthen).toBe(true);
    expect(summary.canHandoffToBuild).toBe(true);
    expect(summary.items[0]?.summary).toBe("加强记忆连接");
    expect(summary.items[2]?.summary).toBe("建立情境记忆");
    expect(summary.items[1]?.capabilityNote).toBeUndefined();
    expect(summary.buildButtonLabel).toBe("开始建立 3 个词");
    expect(summary.strengthenButtonLabel).toBe("开始强化 1 个词");
    const build = await controller.continueProbe({
      runId: summary.handle.runId,
      revision: summary.handle.revision,
      intent: "START_BUILD",
    });
    assertKind(build, "GUIDED");
    expect(build.context.title).toBe("建立碗的情境记忆");
    expect(build.context.settingLabel).toContain("教学阶段");
  });
});
