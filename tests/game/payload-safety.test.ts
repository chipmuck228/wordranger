import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { toGameSubmissionFeedback } from "@/server/game-session/game-submission-feedback";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { TaskEvaluation } from "@/domain/tasks/task-evaluation";
import { ANSWER_KEY_FIELDS, collectKeys, createRangerTrialWorld } from "./helpers";

function evaluation(
  overrides: Partial<TaskEvaluation>,
): TaskEvaluation {
  return {
    taskId: "t1",
    lexemeId: "lex-1",
    skill: VocabularySkill.MEANING_RECOGNITION,
    outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
    errorType: null,
    selectedLexemeId: null,
    typedAnswer: null,
    expectedAnswer: "quiet",
    responseTimeMs: 400,
    hintCount: 0,
    occurredAt: "2026-09-16T12:00:00.000Z",
    normalizedTypedAnswer: null,
    isCorrect: true,
    ...overrides,
  };
}

describe("G4 client payload contains no AnswerKey", () => {
  it("start session returns PublicLearningTask without answer-key fields", async () => {
    const { controller } = createRangerTrialWorld();
    const started = await controller.start();
    const keys = collectKeys(JSON.parse(JSON.stringify(started)));
    for (const field of ANSWER_KEY_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
    expect(started.task.responseContract.kind === "CHOICE" || started.task.responseContract.kind === "TEXT_INPUT").toBe(
      true,
    );
  });

  it("submit feedback DTO does not include answer-key internals", async () => {
    const { controller, vocabulary } = createRangerTrialWorld();
    const started = await controller.start();
    if (started.task.responseContract.kind !== "CHOICE") {
      throw new Error("expected a choice task for an unseen learner");
    }
    const lexeme = await vocabulary.getLexeme(started.task.lexemeId);
    const meaning = lexeme?.meaningsZh.find((item) => item.trim()) ?? "";
    const wrong =
      started.task.responseContract.options.find(
        (option) => option.content.text !== meaning,
      ) ?? started.task.responseContract.options[0];
    const submitted = await controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: { kind: "CHOICE", optionId: wrong.id },
      responseTimeMs: 800,
    });
    const keys = collectKeys(JSON.parse(JSON.stringify(submitted)));
    for (const field of ANSWER_KEY_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
    expect(submitted.feedback.status).toBeTruthy();
    expect(submitted.feedback.message.length).toBeGreaterThan(0);
  });
});

describe("GameSubmissionFeedback mapping", () => {
  it("maps evidence outcomes to presentation status only", () => {
    expect(
      toGameSubmissionFeedback(
        evaluation({ outcome: EvidenceOutcome.INDEPENDENT_CORRECT }),
      ).status,
    ).toBe("CORRECT");
    expect(
      toGameSubmissionFeedback(
        evaluation({ outcome: EvidenceOutcome.ASSISTED_CORRECT }),
      ).status,
    ).toBe("ASSISTED");
    expect(
      toGameSubmissionFeedback(
        evaluation({
          outcome: EvidenceOutcome.INCORRECT,
          isCorrect: false,
          expectedAnswer: "quiet",
        }),
      ),
    ).toMatchObject({
      status: "INCORRECT",
      message: "正确答案：quiet",
    });
  });
});
