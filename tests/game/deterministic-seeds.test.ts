import { describe, expect, it } from "vitest";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import {
  createSchedulerRandom,
  createTaskRandom,
  schedulerRandomSeed,
  taskRandomSeed,
} from "@/server/game-session/ranger-trial-seeds";
import { makeNeed } from "../tasks/helpers";
import { createRangerTrialWorld } from "./helpers";

function optionTexts(task: { responseContract: { kind: string; options?: Array<{ content: { text: string } }> } }) {
  if (task.responseContract.kind !== "CHOICE" || !task.responseContract.options) {
    return [];
  }
  return task.responseContract.options.map((option) => option.content.text);
}

describe("Ranger Trial deterministic seeds", () => {
  it("RAND1: same sessionId + needId yields the same generated option order", async () => {
    const world = createRangerTrialWorld();
    const [quiet] = await world.vocabulary.findLexemeByLemma("quiet");
    const generator = new DefaultTaskGenerator(world.vocabulary);
    const need = makeNeed({
      id: "need-quiet",
      lexemeId: quiet.id,
      targetSkill: VocabularySkill.MEANING_RECOGNITION,
    });
    const request = {
      need,
      desiredDifficulty: 0.45,
      recentTasks: [],
      now: "2026-09-16T12:00:00.000Z",
    };
    const first = await generator.generate({
      ...request,
      createId: () => "task-a",
      random: createTaskRandom("RANGER_TRIAL", "sess-rand", need.id),
    });
    const second = await generator.generate({
      ...request,
      createId: () => "task-b",
      random: createTaskRandom("RANGER_TRIAL", "sess-rand", need.id),
    });
    expect(first.status).toBe("GENERATED");
    expect(second.status).toBe("GENERATED");
    if (first.status !== "GENERATED" || second.status !== "GENERATED") {
      throw new Error("expected generated tasks");
    }
    expect(optionTexts(first.value.publicTask)).toEqual(
      optionTexts(second.value.publicTask),
    );
  });

  it("RAND2: different needId uses a different seed stream", () => {
    expect(taskRandomSeed("RANGER_TRIAL", "sess-1", "need-a")).not.toBe(
      taskRandomSeed("RANGER_TRIAL", "sess-1", "need-b"),
    );
    const first = createTaskRandom("RANGER_TRIAL", "sess-1", "need-a");
    const second = createTaskRandom("RANGER_TRIAL", "sess-1", "need-b");
    expect(first.next()).not.toBe(second.next());
    expect(schedulerRandomSeed("RANGER_TRIAL", "sess-1")).not.toBe(
      schedulerRandomSeed("RANGER_TRIAL", "sess-2"),
    );
    expect(createSchedulerRandom("RANGER_TRIAL", "sess-1").next()).not.toBe(
      createSchedulerRandom("RANGER_TRIAL", "sess-2").next(),
    );
    expect(schedulerRandomSeed("RANGER_TRIAL", "sess-1")).toBe(
      "scheduler:RANGER_TRIAL:sess-1",
    );
    expect(taskRandomSeed("WORD_BUBBLE", "sess-1", "need-a")).toBe(
      "task:WORD_BUBBLE:sess-1:need-a",
    );
  });

  it("RAND3: a new controller instance regenerates from persisted need identity", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.needs[0]).toBeTruthy();
    const generator = new DefaultTaskGenerator(world.vocabulary);
    const regenerated = await generator.generate({
      need: record!.needs[0],
      desiredDifficulty: 0.45,
      recentTasks: [],
      now: "2026-09-16T12:00:00.000Z",
      createId: () => "regen-task",
      random: createTaskRandom("RANGER_TRIAL", started.session.sessionId, record!.needs[0].id),
    });
    expect(regenerated.status).toBe("GENERATED");
    if (regenerated.status !== "GENERATED") {
      throw new Error("expected generated task");
    }
    if (started.task.responseContract.kind === "CHOICE") {
      expect(optionTexts(regenerated.value.publicTask)).toEqual(
        optionTexts(started.task),
      );
    }
    const resumed = await world.createController().resume(started.session.sessionId);
    expect(resumed.task?.id).toBe(started.task.id);
  });
});
