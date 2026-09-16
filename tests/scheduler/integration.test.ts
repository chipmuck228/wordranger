import { describe, expect, it } from "vitest";
import {
  AnswerMode,
  EvidenceErrorType,
  EvidenceOutcome,
  PromptMode,
} from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { submitTaskAction } from "@/server/tasks/submit-task-action";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import {
  daysAfter,
  feed,
  makeEvidence,
  sequentialIdFactory,
  TEST_USER_ID,
} from "../learning/helpers";

const T0 = "2026-03-01T09:00:00.000Z";
const SESSION = "scheduler-int-session";

describe("Scheduler integration", () => {
  it("quiet spelling weakness + due review → SPELLING_RECALL_TYPING → submit changes the next plan", async () => {
    const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const learning = new InMemoryLearningRepository();
    const query = new InMemoryLearningStateQueryRepository(learning);
    const tasks = new InMemoryLearningTaskRepository();
    const generator = new DefaultTaskGenerator(vocabulary);

    await feed(
      learning,
      makeEvidence("spell-fail", "prep", T0, {
        lexemeId: quiet.id,
        skill: VocabularySkill.SPELLING_RECALL,
        outcome: EvidenceOutcome.INCORRECT,
        answerMode: AnswerMode.SPELLING,
        promptMode: PromptMode.MEANING_TO_SPELLING,
        taskType: "SPELLING_RECALL_TYPING",
        errorType: EvidenceErrorType.SPELLING_MAJOR,
        typedAnswer: "quete",
        expectedAnswer: "quiet",
      }),
    );

    const before = await learning.getStudentLexemeModel(TEST_USER_ID, quiet.id);
    expect(before).toBeTruthy();
    expect(
      before?.weaknesses.some(
        (weakness) =>
          weakness.type === WeaknessType.SPELLING && weakness.resolvedAt === null,
      ),
    ).toBe(true);
    expect(before?.nextReviewAt).toBeTruthy();

    const scheduleNow = daysAfter(before!.nextReviewAt!, 1);
    const firstPlan = await planLearningSession({
      userId: TEST_USER_ID,
      now: scheduleNow,
      requestedNeedCount: 8,
      createId: sequentialIdFactory("plan-1"),
      random: new SeededRandomSource("integration-1"),
      vocabulary,
      query,
    });
    const spellingNeed = firstPlan.needs.find(
      (need) =>
        need.lexemeId === quiet.id &&
        need.targetSkill === VocabularySkill.SPELLING_RECALL,
    );
    expect(spellingNeed).toBeTruthy();
    expect(spellingNeed?.reason).toBe("WEAKNESS");

    const generated = await generator.generate({
      need: spellingNeed!,
      desiredDifficulty: 0.45,
      recentTasks: [],
      now: scheduleNow,
      createId: sequentialIdFactory("task-1"),
      random: new SeededRandomSource("integration-task"),
    });
    expect(generated.status).toBe("GENERATED");
    if (generated.status !== "GENERATED") {
      return;
    }
    expect(generated.value.publicTask.taskType).toBe(
      LearningTaskType.SPELLING_RECALL_TYPING,
    );

    await tasks.saveGeneratedTask({
      task: generated.value,
      assignment: { userId: TEST_USER_ID, sessionId: SESSION },
    });

    const submitNow = daysAfter(scheduleNow, 0.01);
    const submitted = await submitTaskAction({
      taskId: generated.value.publicTask.id,
      action: {
        kind: "TEXT_INPUT",
        taskId: generated.value.publicTask.id,
        value: generated.value.answerKey.exactAcceptedTexts[0] ?? "quiet",
        hintCount: 0,
        responseTimeMs: 800,
        occurredAt: submitNow,
      },
      userId: TEST_USER_ID,
      sessionId: SESSION,
      gameId: "debug-scheduler-lab",
      evidenceId: "ev-int-1",
      learningTaskRepository: tasks,
      learningRepository: learning,
      now: submitNow,
    });
    expect(submitted.evidence.taskId).toBe(generated.value.publicTask.id);
    expect(submitted.learningResult.model.evidenceCount).toBeGreaterThan(
      before!.evidenceCount,
    );

    const secondPlan = await planLearningSession({
      userId: TEST_USER_ID,
      now: submitNow,
      requestedNeedCount: 8,
      createId: sequentialIdFactory("plan-2"),
      random: new SeededRandomSource("integration-1"),
      vocabulary,
      query,
    });
    const again = secondPlan.needs.find(
      (need) =>
        need.lexemeId === quiet.id &&
        need.targetSkill === VocabularySkill.SPELLING_RECALL,
    );
    const firstPriority = spellingNeed!.priority;
    if (again) {
      expect(again.priority).toBeLessThanOrEqual(firstPriority);
      expect(again.avoidRecentTaskTypes).toContain("SPELLING_RECALL_TYPING");
    } else {
      expect(
        secondPlan.needs.some(
          (need) =>
            need.lexemeId === quiet.id &&
            need.targetSkill === VocabularySkill.SPELLING_RECALL,
        ),
      ).toBe(false);
    }
  });
});
