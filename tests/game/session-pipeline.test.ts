import { describe, expect, it } from "vitest";
import { EvidenceErrorType, EvidenceOutcome } from "@/domain/learning/evidence.types";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import {
  makeModel,
  makeWeakness,
} from "../scheduler/helpers";
import { createRangerTrialWorld } from "./helpers";

describe("Ranger Trial session pipeline", () => {
  it("G6: wrong meaning choice goes through submitTaskAction to Learning Core", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    expect(started.task.taskType).toBe(LearningTaskType.MEANING_CHOICE);
    if (started.task.responseContract.kind !== "CHOICE") {
      throw new Error("expected CHOICE");
    }
    const lexeme = await world.vocabulary.getLexeme(started.task.lexemeId);
    const meaning = lexeme?.meaningsZh.find((item) => item.trim()) ?? "";
    const wrong = started.task.responseContract.options.find(
      (option) => option.content.text !== meaning,
    );
    expect(wrong).toBeTruthy();
    const submitted = await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: { kind: "CHOICE", optionId: wrong!.id },
      responseTimeMs: 900,
    });
    expect(submitted.feedback.status).toBe("INCORRECT");
    const evidence = world.learning.listEvidenceForUser(world.userId);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].outcome).toBe(EvidenceOutcome.INCORRECT);
    expect(evidence[0].taskId).toBe(started.task.id);
    const model = await world.learning.getStudentLexemeModel(
      world.userId,
      started.task.lexemeId,
    );
    expect(model).toBeTruthy();
    expect(model?.evidenceCount).toBe(1);
  });

  it("G7: typing submit is graded server-side from the typed value", async () => {
    const world = createRangerTrialWorld();
    const [quiet] = await world.vocabulary.findLexemeByLemma("quiet");
    await world.learning.saveStudentLexemeModel(
      makeModel(quiet.id, {
        userId: world.userId,
        masteryStage: MasteryStage.RECOGNIZED,
        nextReviewAt: "2026-09-01T00:00:00.000Z",
        weaknesses: [
          makeWeakness({
            id: "w-spell",
            type: WeaknessType.SPELLING,
            skill: VocabularySkill.SPELLING_RECALL,
          }),
        ],
      }),
    );
    const started = await world.controller.start();
    expect(started.task.taskType).toBe(LearningTaskType.SPELLING_RECALL_TYPING);
    expect(started.task.responseContract.kind).toBe("TEXT_INPUT");
    const submitted = await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: { kind: "TEXT_INPUT", value: quiet.lemma },
      responseTimeMs: 1100,
    });
    expect(submitted.feedback.status).toBe("CORRECT");
    const evidence = world.learning.listEvidenceForUser(world.userId);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    expect(evidence[0].typedAnswer).toBe(quiet.lemma);
  });

  it("G8: confusable wrong choice creates CONFUSION through Learning Core, not the renderer", async () => {
    const world = createRangerTrialWorld();
    const [quiet] = await world.vocabulary.findLexemeByLemma("quiet");
    const [quite] = await world.vocabulary.findLexemeByLemma("quite");
    await world.learning.saveStudentLexemeModel(
      makeModel(quiet.id, {
        userId: world.userId,
        masteryStage: MasteryStage.RECOGNIZED,
        nextReviewAt: "2026-09-01T00:00:00.000Z",
        weaknesses: [
          makeWeakness({
            id: "w-conf",
            type: WeaknessType.CONFUSION,
            skill: VocabularySkill.MEANING_RECOGNITION,
            relatedLexemeId: quite.id,
          }),
        ],
      }),
    );
    const started = await world.controller.start();
    expect(started.task.taskType).toBe(LearningTaskType.CONFUSABLE_CHOICE);
    if (started.task.responseContract.kind !== "CHOICE") {
      throw new Error("expected CHOICE");
    }
    const quiteMeaning = quite.meaningsZh.find((item) => item.trim());
    const quiteOption = started.task.responseContract.options.find(
      (option) => option.content.text === quiteMeaning,
    );
    expect(quiteOption).toBeTruthy();
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: { kind: "CHOICE", optionId: quiteOption!.id },
      responseTimeMs: 700,
    });
    const evidence = world.learning.listEvidenceForUser(world.userId);
    expect(evidence[0].errorType).toBe(EvidenceErrorType.CONFUSED_WITH_WORD);
    const model = await world.learning.getStudentLexemeModel(
      world.userId,
      quiet.id,
    );
    expect(
      model?.weaknesses.some(
        (item) =>
          item.type === WeaknessType.CONFUSION &&
          item.relatedLexemeId === quite.id,
      ),
    ).toBe(true);
  });

  it("G9: duplicate submit creates only one Evidence", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    if (started.task.responseContract.kind !== "CHOICE") {
      throw new Error("expected CHOICE");
    }
    const optionId = started.task.responseContract.options[0].id;
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: { kind: "CHOICE", optionId },
      responseTimeMs: 400,
    });
    await expect(
      world.controller.submit({
        sessionId: started.session.sessionId,
        taskId: started.task.id,
        intent: { kind: "CHOICE", optionId },
        responseTimeMs: 400,
      }),
    ).rejects.toMatchObject({ code: "TASK_ALREADY_COMPLETED" });
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.completed).toBe(1);
    expect(record?.stats.attempted).toBe(1);
  });

  it("G10: session advances task-by-task then completes", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    expect(started.session.total).toBeGreaterThanOrEqual(3);
    let sessionId = started.session.sessionId;
    let task = started.task;
    for (let index = 0; index < started.session.total; index += 1) {
      const intent =
        task.responseContract.kind === "CHOICE"
          ? {
              kind: "CHOICE" as const,
              optionId: task.responseContract.options[0].id,
            }
          : { kind: "TEXT_INPUT" as const, value: "x" };
      await world.controller.submit({
        sessionId,
        taskId: task.id,
        intent,
        responseTimeMs: 500,
      });
      const continued = await world.controller.continue(sessionId);
      if (index === started.session.total - 1) {
        expect(continued.completed).toBe(true);
        expect(continued.task).toBeUndefined();
      } else {
        expect(continued.completed).toBe(false);
        expect(continued.task).toBeTruthy();
        expect(continued.task!.id).not.toBe(task.id);
        task = continued.task!;
        sessionId = continued.progress.sessionId;
      }
    }
  });

  it("resume returns the active PublicLearningTask without regenerating", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const resumed = await world.controller.resume(started.session.sessionId);
    expect(resumed.task?.id).toBe(started.task.id);
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(0);
  });

  it("unknown session is a typed error", async () => {
    const world = createRangerTrialWorld();
    await expect(world.controller.resume("missing")).rejects.toBeInstanceOf(
      GameSessionError,
    );
  });
});
