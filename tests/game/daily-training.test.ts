import { describe, expect, it } from "vitest";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import {
  DIRECT_PRACTICE_PRESENTATION_TYPE,
  MATCHING_GAME_ID,
  MATCHING_GAME_TYPE,
  RANGER_TRIAL_GAME_ID,
  RANGER_TRIAL_GAME_TYPE,
  SNAKE_GAME_ID,
  SNAKE_GAME_TYPE,
  WORD_BUBBLE_GAME_ID,
  WORD_BUBBLE_GAME_TYPE,
} from "@/server/auth/v1-user";
import {
  rendererByGameType,
  TRAINING_RENDERERS,
} from "@/server/training/renderer-registry";
import { selectRendererForTask } from "@/server/training/renderer-selector";
import {
  ANSWER_KEY_FIELDS,
  collectKeys,
  confusableChoiceTask,
  createDailyTrainingWorld,
  meaningChoiceTask,
  relationChoiceTask,
  spellingTask,
  trainingIntent,
} from "./helpers";

function queuedRendererSelector(order: string[]) {
  let index = 0;
  return ((input: Parameters<typeof selectRendererForTask>[0]) => {
    const wanted = order[index] ?? RANGER_TRIAL_GAME_TYPE;
    index += 1;
    const definition = rendererByGameType(wanted);
    if (definition?.canRenderTask(input.task)) {
      return definition;
    }
    return selectRendererForTask(input);
  }) as typeof selectRendererForTask;
}

async function playThrough(
  world: ReturnType<typeof createDailyTrainingWorld>,
  count: number,
) {
  const started = await world.controller.start();
  let current = started;
  const renderers = [started.rendererGameType];
  for (let i = 0; i < count; i += 1) {
    await world.controller.submit({
      sessionId: current.session.sessionId,
      taskId: current.task.id,
      intent: trainingIntent(current.task),
      responseTimeMs: 400,
    });
    const continued = await world.controller.continue(current.session.sessionId);
    if (continued.completed) {
      return { started, continued, renderers };
    }
    if (!continued.task || !continued.rendererGameType) {
      throw new Error("expected next training task");
    }
    renderers.push(continued.rendererGameType);
    current = {
      session: continued.progress,
      task: continued.task,
      rendererGameType: continued.rendererGameType,
    };
  }
  throw new Error("training round did not complete");
}

describe("Daily Training controller", () => {
  it("D1/D2: start creates one 8-need plan", async () => {
    const world = createDailyTrainingWorld();
    const started = await world.controller.start();
    const record = await world.sessions.get(started.session.sessionId);
    expect(record).toBeTruthy();
    expect(record?.planId).toBe(started.session.planId);
    expect(record?.needs).toHaveLength(8);
    expect(record?.items).toHaveLength(8);
    expect(started.session.total).toBe(8);
    expect(started.session.current).toBe(1);
    expect((await world.sessions.get("missing"))).toBeNull();
  });

  it("D3: first generated task gets a compatible renderer", async () => {
    const world = createDailyTrainingWorld();
    const started = await world.controller.start();
    const renderer = rendererByGameType(started.rendererGameType);
    expect(renderer).toBeTruthy();
    expect(renderer?.canRenderTask(started.task)).toBe(true);
    expect(started.session.rendererGameType).toBe(started.rendererGameType);
    expect(started.rendererGameType).toBe(DIRECT_PRACTICE_PRESENTATION_TYPE);
  });

  it("new sessions always assign DIRECT_PRACTICE and Evidence.gameId RANGER_TRIAL", async () => {
    const world = createDailyTrainingWorld();
    const started = await world.controller.start();
    expect(started.rendererGameType).toBe(DIRECT_PRACTICE_PRESENTATION_TYPE);
    expect(started.session.rendererGameType).toBe(DIRECT_PRACTICE_PRESENTATION_TYPE);
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: trainingIntent(started.task),
      responseTimeMs: 400,
    });
    const evidence = world.learning.listEvidenceForUser(world.userId);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].gameId).toBe(RANGER_TRIAL_GAME_ID);
    expect(evidence[0].gameId).not.toBe("DIRECT_PRACTICE");
    expect(evidence[0].gameId).not.toBe("DAILY_TRAINING");
  });

  it("resumes an old game renderer then assigns direct on the next item", async () => {
    const legacy = createDailyTrainingWorld("legacy-direct-user", {
      selectRenderer: queuedRendererSelector([WORD_BUBBLE_GAME_TYPE]),
    });
    const started = await legacy.controller.start();
    expect(started.rendererGameType).toBe(WORD_BUBBLE_GAME_TYPE);
    const fresh = createDailyTrainingWorld("legacy-direct-user", {
      learning: legacy.learning,
      tasks: legacy.tasks,
      sessions: legacy.sessions,
    });
    const resumed = await fresh.controller.resume(started.session.sessionId);
    expect(resumed.task?.id).toBe(started.task.id);
    expect(resumed.rendererGameType).toBe(DIRECT_PRACTICE_PRESENTATION_TYPE);
    expect(fresh.learning.listEvidenceForUser(fresh.userId)).toHaveLength(0);
    await fresh.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: trainingIntent(started.task),
      responseTimeMs: 300,
    });
    expect(fresh.learning.listEvidenceForUser(fresh.userId)).toHaveLength(1);
    expect(fresh.learning.listEvidenceForUser(fresh.userId)[0].gameId).toBe(
      WORD_BUBBLE_GAME_ID,
    );
    const continued = await fresh.controller.continue(started.session.sessionId);
    expect(continued.completed).toBe(false);
    expect(continued.rendererGameType).toBe(DIRECT_PRACTICE_PRESENTATION_TYPE);
    expect(continued.task?.id).not.toBe(started.task.id);
  });

  it("D4: TEXT_INPUT routes to Ranger Trial", () => {
    const renderer = selectRendererForTask({ task: spellingTask() });
    expect(renderer.gameType).toBe(RANGER_TRIAL_GAME_TYPE);
    expect(renderer.gameId).toBe(RANGER_TRIAL_GAME_ID);
  });

  it("D7/D8: selected renderer and task persist across resume", async () => {
    const world = createDailyTrainingWorld();
    const started = await world.controller.start();
    const resumed = await world.createController().resume(started.session.sessionId);
    expect(resumed.completed).toBe(false);
    expect(resumed.task?.id).toBe(started.task.id);
    expect(resumed.rendererGameType).toBe(started.rendererGameType);
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(0);
  });

  it("D9/D10: submit writes one Evidence with the actual renderer gameId", async () => {
    const world = createDailyTrainingWorld();
    const started = await world.controller.start();
    const renderer = rendererByGameType(started.rendererGameType);
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: trainingIntent(started.task),
      responseTimeMs: 500,
    });
    const evidence = world.learning.listEvidenceForUser(world.userId);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].taskId).toBe(started.task.id);
    expect(evidence[0].gameId).toBe(renderer?.gameId);
    expect(evidence[0].gameId).not.toBe("DAILY_TRAINING");
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.stats.attempted).toBe(1);
    expect(record?.items[0]?.status).toBe("COMPLETED");
  });

  it("D11/D12: continue advances one item and completes after the last", async () => {
    const world = createDailyTrainingWorld();
    const result = await playThrough(world, 8);
    expect(result.continued.completed).toBe(true);
    expect(result.continued.stats.attempted).toBe(8);
    const record = await world.sessions.get(result.started.session.sessionId);
    expect(record?.phase).toBe("completed");
    expect(record?.currentNeedIndex).toBe(8);
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(8);
  });

  it("D84: mixed renderers submit through the same pipeline with renderer gameIds", async () => {
    const order = [
      WORD_BUBBLE_GAME_TYPE,
      MATCHING_GAME_TYPE,
      RANGER_TRIAL_GAME_TYPE,
      SNAKE_GAME_TYPE,
    ];
    const world = createDailyTrainingWorld("daily-mixed-user", {
      requestedNeedCount: 4,
      selectRenderer: queuedRendererSelector(order),
    });
    const started = await world.controller.start();
    expect(started.rendererGameType).toBe(WORD_BUBBLE_GAME_TYPE);
    const renderers = [started.rendererGameType];
    let current = started;
    for (let i = 0; i < 4; i += 1) {
      await world.controller.submit({
        sessionId: current.session.sessionId,
        taskId: current.task.id,
        intent: trainingIntent(current.task),
        responseTimeMs: 300,
      });
      const continued = await world.controller.continue(current.session.sessionId);
      if (continued.completed) {
        break;
      }
      current = {
        session: continued.progress,
        task: continued.task!,
        rendererGameType: continued.rendererGameType!,
      };
      renderers.push(current.rendererGameType);
    }
    expect(renderers.slice(0, 4)).toEqual(order);
    const evidence = world.learning.listEvidenceForUser(world.userId);
    expect(evidence).toHaveLength(4);
    expect(evidence.map((item) => item.gameId)).toEqual([
      WORD_BUBBLE_GAME_ID,
      MATCHING_GAME_ID,
      RANGER_TRIAL_GAME_ID,
      SNAKE_GAME_ID,
    ]);
    expect(new Set(evidence.map((item) => item.taskId)).size).toBe(4);
    for (const item of evidence) {
      expect(item.taskId).toBeTruthy();
      expect(item.sessionId).toBe(started.session.sessionId);
    }
  });

  it("D85: Matching/Snake refresh restores the same task and renderer with no Evidence", async () => {
    const world = createDailyTrainingWorld("daily-refresh-user", {
      selectRenderer: queuedRendererSelector([MATCHING_GAME_TYPE]),
    });
    const started = await world.controller.start();
    expect(started.rendererGameType).toBe(MATCHING_GAME_TYPE);
    const resumed = await world.createController().resume(started.session.sessionId);
    expect(resumed.task?.id).toBe(started.task.id);
    expect(resumed.rendererGameType).toBe(DIRECT_PRACTICE_PRESENTATION_TYPE);
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(0);
  });

  it("D86: concurrent submit keeps one Evidence and one stats increment", async () => {
    const world = createDailyTrainingWorld();
    const started = await world.controller.start();
    const payload = {
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: trainingIntent(started.task),
      responseTimeMs: 400,
    };
    await Promise.allSettled([
      world.controller.submit(payload),
      world.createController().submit(payload),
    ]);
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.stats.attempted).toBe(1);
    expect(record?.lastCompletedTaskId).toBe(started.task.id);
  });

  it("D87: double continue advances once", async () => {
    const world = createDailyTrainingWorld();
    const started = await world.controller.start();
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: trainingIntent(started.task),
      responseTimeMs: 400,
    });
    const results = await Promise.allSettled([
      world.controller.continue(started.session.sessionId),
      world.createController().continue(started.session.sessionId),
    ]);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.currentNeedIndex).toBe(1);
    const returned = results
      .filter(
        (result): result is PromiseFulfilledResult<
          Awaited<ReturnType<typeof world.controller.continue>>
        > => result.status === "fulfilled",
      )
      .flatMap((result) =>
        result.value.task ? [result.value.task.id] : [],
      );
    expect(new Set(returned).size).toBeLessThanOrEqual(1);
    for (const taskId of returned) {
      expect(taskId).toBe(record?.currentTaskId);
    }
  });

  it("D88: start/submit/resume payloads stay AnswerKey-free", async () => {
    const world = createDailyTrainingWorld();
    const started = await world.controller.start();
    const submitted = await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: trainingIntent(started.task),
      responseTimeMs: 200,
    });
    const resumed = await world.controller.resume(started.session.sessionId);
    for (const payload of [started, submitted, resumed]) {
      const keys = collectKeys(JSON.parse(JSON.stringify(payload)));
      for (const field of ANSWER_KEY_FIELDS) {
        expect(keys.has(field), field).toBe(false);
      }
    }
  });

  it("D110: second round plans from the updated learner snapshot", async () => {
    const world = createDailyTrainingWorld("daily-adapt-user", {
      requestedNeedCount: 2,
    });
    const first = await playThrough(world, 2);
    expect(first.continued.completed).toBe(true);
    const modelsAfterFirst = world.learning.listStudentLexemeModels(world.userId);
    expect(modelsAfterFirst.length).toBeGreaterThan(0);
    const second = await world.createController().start();
    expect(second.session.sessionId).not.toBe(first.started.session.sessionId);
    expect(second.session.planId).not.toBe(first.started.session.planId);
    for (const model of modelsAfterFirst) {
      const latest = await world.learning.getStudentLexemeModel(
        world.userId,
        model.lexemeId,
      );
      expect(latest).toBeTruthy();
      expect(latest?.updatedAt).toBe(model.updatedAt);
    }
  });

  it("P2/P3/P9/P10: next Daily Training round admits new unseen words from updated models", async () => {
    const world = createDailyTrainingWorld("daily-progress-user", {
      requestedNeedCount: 4,
    });
    const started = await world.controller.start();
    const firstRecord = await world.sessions.get(started.session.sessionId);
    const firstLexemes = (firstRecord?.needs ?? []).map((need) => need.lexemeId);
    expect(firstLexemes).toHaveLength(4);

    let current = started;
    const missLexemeId = firstLexemes[firstLexemes.length - 1];
    for (let index = 0; index < 4; index += 1) {
      const assigned = await world.tasks.getTaskForEvaluation(current.task.id);
      expect(assigned).toBeTruthy();
      const key = assigned!.task.answerKey;
      const correct = current.task.lexemeId !== missLexemeId;
      const intent =
        current.task.responseContract.kind === "CHOICE"
          ? {
              kind: "CHOICE" as const,
              optionId: correct
                ? key.correctOptionIds[0]
                : (current.task.responseContract.options.find(
                    (option) => option.id !== key.correctOptionIds[0],
                  )?.id ?? key.correctOptionIds[0]),
            }
          : {
              kind: "TEXT_INPUT" as const,
              value: correct ? (key.exactAcceptedTexts[0] ?? "word") : "zzzz",
            };
      const submitted = await world.controller.submit({
        sessionId: current.session.sessionId,
        taskId: current.task.id,
        intent,
        responseTimeMs: 400,
      });
      const payloadKeys = collectKeys(JSON.parse(JSON.stringify(submitted)));
      for (const field of ANSWER_KEY_FIELDS) {
        expect(payloadKeys.has(field), field).toBe(false);
      }
      const continued = await world.controller.continue(current.session.sessionId);
      if (continued.completed) {
        break;
      }
      current = {
        session: continued.progress,
        task: continued.task!,
        rendererGameType: continued.rendererGameType!,
      };
    }

    const evidence = world.learning.listEvidenceForUser(world.userId);
    expect(evidence).toHaveLength(4);
    expect(evidence.every((item) => item.gameId !== "DAILY_TRAINING")).toBe(true);
    expect(new Set(evidence.map((item) => item.taskId)).size).toBe(4);

    const second = await world.createController().start();
    const secondKeys = collectKeys(JSON.parse(JSON.stringify(second)));
    for (const field of ANSWER_KEY_FIELDS) {
      expect(secondKeys.has(field), field).toBe(false);
    }
    expect(second.session.planId).not.toBe(started.session.planId);
    const secondRecord = await world.sessions.get(second.session.sessionId);
    const secondLexemes = (secondRecord?.needs ?? []).map((need) => need.lexemeId);
    expect(secondLexemes.some((lexemeId) => !firstLexemes.includes(lexemeId))).toBe(
      true,
    );
    expect(secondLexemes).toContain(missLexemeId);
    const strong = firstLexemes.filter((lexemeId) => lexemeId !== missLexemeId);
    for (const lexemeId of strong) {
      expect(
        secondRecord?.needs.some(
          (need) =>
            need.lexemeId === lexemeId &&
            need.targetSkill === "MEANING_RECOGNITION",
        ),
      ).toBe(false);
    }
  });

  it("uses revision CAS and rejects stale writes", async () => {
    const world = createDailyTrainingWorld();
    const started = await world.controller.start();
    const first = await world.sessions.get(started.session.sessionId);
    expect(first?.revision).toBe(1);
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: trainingIntent(started.task),
      responseTimeMs: 200,
    });
    await expect(world.sessions.save(first!)).rejects.toBeInstanceOf(GameSessionError);
    await expect(world.sessions.save(first!)).rejects.toMatchObject({
      code: "SESSION_CONFLICT",
    });
  });
});

describe("Daily Training renderer selector", () => {
  it("D13: never selects a renderer that cannot render the task", () => {
    for (const task of [meaningChoiceTask(), spellingTask()]) {
      const selected = selectRendererForTask({ task });
      expect(selected.canRenderTask(task)).toBe(true);
    }
  });

  it("D14: is deterministic for the same input", () => {
    const task = meaningChoiceTask();
    const first = selectRendererForTask({
      task,
      recentRendererTypes: [WORD_BUBBLE_GAME_TYPE, MATCHING_GAME_TYPE],
    });
    const second = selectRendererForTask({
      task,
      recentRendererTypes: [WORD_BUBBLE_GAME_TYPE, MATCHING_GAME_TYPE],
    });
    expect(first.gameType).toBe(second.gameType);
  });

  it("D15: Ranger Trial is the compatible fallback", () => {
    const ranger = TRAINING_RENDERERS.find(
      (item) => item.gameType === RANGER_TRIAL_GAME_TYPE,
    )!;
    const selected = selectRendererForTask({
      task: meaningChoiceTask(),
      availableRenderers: [ranger],
    });
    expect(selected.gameType).toBe(RANGER_TRIAL_GAME_TYPE);
  });

  it("D16: diversity does not override compatibility", () => {
    const selected = selectRendererForTask({
      task: spellingTask(),
      recentRendererTypes: [RANGER_TRIAL_GAME_TYPE, RANGER_TRIAL_GAME_TYPE],
    });
    expect(selected.gameType).toBe(RANGER_TRIAL_GAME_TYPE);
  });

  it("D17: TEXT_INPUT never routes to a CHOICE-only renderer", () => {
    const selected = selectRendererForTask({ task: spellingTask() });
    expect(selected.gameType).toBe(RANGER_TRIAL_GAME_TYPE);
    try {
      selectRendererForTask({
        task: spellingTask(),
        availableRenderers: TRAINING_RENDERERS.filter(
          (item) => item.gameType !== RANGER_TRIAL_GAME_TYPE,
        ),
      });
      throw new Error("expected selector failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "NO_COMPATIBLE_RENDERER" });
    }
  });

  it("D5/D6: MEANING prefers Bubble/Snake and RELATION prefers Matching/Bubble", () => {
    expect(selectRendererForTask({ task: meaningChoiceTask() }).gameType).toBe(
      WORD_BUBBLE_GAME_TYPE,
    );
    expect(
      selectRendererForTask({
        task: meaningChoiceTask(),
        recentRendererTypes: [WORD_BUBBLE_GAME_TYPE, WORD_BUBBLE_GAME_TYPE],
      }).gameType,
    ).toBe(SNAKE_GAME_TYPE);
    expect(selectRendererForTask({ task: relationChoiceTask() }).gameType).toBe(
      MATCHING_GAME_TYPE,
    );
    expect(selectRendererForTask({ task: confusableChoiceTask() }).gameType).toBe(
      MATCHING_GAME_TYPE,
    );
    expect(
      selectRendererForTask({
        task: relationChoiceTask(),
        recentRendererTypes: [MATCHING_GAME_TYPE, MATCHING_GAME_TYPE],
      }).gameType,
    ).toBe(WORD_BUBBLE_GAME_TYPE);
  });

  it("throws NO_COMPATIBLE_RENDERER when the registry is empty", () => {
    try {
      selectRendererForTask({
        task: meaningChoiceTask(),
        availableRenderers: [],
      });
      throw new Error("expected selector failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "NO_COMPATIBLE_RENDERER" });
    }
  });
});
