import { describe, expect, it } from "vitest";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import {
  LearningTaskType,
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
} from "@/domain/tasks/task-type";
import { assertSafePublicPayload } from "@/server/free-practice/session/public-payload";
import {
  createSessionHarness,
  unseenLexemes,
  USER_A,
} from "./helpers";

const VOCABULARY_TOKENS = [
  "items",
  "needs",
  "evidence",
  "reason",
  "priority",
  "NEW_WORD",
  "STAGE_PROGRESS",
] as const;

function publicTaskWithVisibleTokens(): PublicLearningTask {
  return {
    id: "task-visible",
    protocolVersion: TASK_PROTOCOL_VERSION,
    generatorVersion: TASK_GENERATOR_VERSION,
    learningNeedId: "item-1",
    lexemeId: "lex-001",
    targetSkill: VocabularySkill.MEANING_RECOGNITION,
    taskType: LearningTaskType.MEANING_CHOICE,
    promptMode: PromptMode.WORD_TO_MEANING,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    difficulty: 0.45,
    prompt: { kind: "LEXEME_TEXT", text: "items" },
    responseContract: {
      kind: "CHOICE",
      options: [
        { id: "opt-1", content: { kind: "TEXT", text: "needs" } },
        { id: "opt-2", content: { kind: "TEXT", text: "evidence" } },
        { id: "opt-3", content: { kind: "TEXT", text: "reason" } },
        { id: "opt-4", content: { kind: "TEXT", text: "priority" } },
      ],
    },
    hints: [
      { id: "hint-1", text: "NEW_WORD" },
      { id: "hint-2", text: "STAGE_PROGRESS" },
    ],
    createdAt: "2026-09-24T02:00:00.000Z",
  };
}

function typingTaskWithPlaceholder(): PublicLearningTask {
  return {
    ...publicTaskWithVisibleTokens(),
    id: "task-placeholder",
    taskType: LearningTaskType.ACTIVE_RECALL_TYPING,
    promptMode: PromptMode.MEANING_TO_WORD,
    answerMode: AnswerMode.TYPING,
    prompt: { kind: "MEANING_TEXT", text: "items" },
    responseContract: {
      kind: "TEXT_INPUT",
      placeholder: "reason",
      maxLength: 64,
    },
  };
}

function generatedFromPublic(task: PublicLearningTask): GeneratedLearningTask {
  return {
    publicTask: task,
    answerKey: {
      taskId: task.id,
      targetLexemeId: task.lexemeId,
      correctOptionIds: ["opt-1"],
      optionLexemeIds: { "opt-1": task.lexemeId },
      exactAcceptedTexts: ["items"],
      semanticAcceptedTexts: [],
    },
    generationTrace: {
      generatorVersion: TASK_GENERATOR_VERSION,
      archetype: task.taskType,
      targetLexemeId: task.lexemeId,
      candidateLexemeIds: [task.lexemeId],
      selectedDistractorLexemeIds: [],
      relationIds: [],
      blockedCandidates: [],
      policyVersion: "v1",
    },
  };
}

function tokenGenerator(task: PublicLearningTask): TaskGenerator {
  return {
    async generate(request) {
      return {
        status: "GENERATED",
        value: generatedFromPublic({
          ...task,
          id: request.createId(),
          learningNeedId: request.need.id,
          lexemeId: request.need.lexemeId,
          targetSkill: request.need.targetSkill,
        }),
      };
    },
  };
}

function startedEnvelope(task: PublicLearningTask) {
  return {
    status: "STARTED" as const,
    session: {
      sessionId: "session-1",
      revision: 1,
      source: "UNSEEN" as const,
      requestedCount: 5,
      plannedCount: 5,
      current: 1,
      currentTaskId: task.id,
      phase: "AWAITING_ACTION" as const,
      attempted: 0,
      correct: 0,
      presentationGameType: "RANGER_TRIAL" as const,
    },
    task,
  };
}

describe("Free Practice public payload structural safety", () => {
  it("A. visible vocabulary tokens pass and start/resume succeed", async () => {
    const choice = publicTaskWithVisibleTokens();
    const typing = typingTaskWithPlaceholder();
    expect(() => assertSafePublicPayload(startedEnvelope(choice))).not.toThrow();
    expect(() => assertSafePublicPayload(startedEnvelope(typing))).not.toThrow();
    for (const token of VOCABULARY_TOKENS) {
      expect(JSON.stringify(choice)).toContain(token);
    }
    expect(JSON.stringify(typing.responseContract)).toContain("reason");

    const { controller, sessions, tasks } = createSessionHarness({
      lexemes: unseenLexemes(8),
      generator: tokenGenerator(choice),
    });
    const started = await controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(started.status).toBe("STARTED");
    if (started.status !== "STARTED") {
      return;
    }
    assertSafePublicPayload(started);
    expect(started.task.prompt).toMatchObject({ text: "items" });
    const resumed = await controller.load(started.session.sessionId);
    expect(resumed.status).toBe("RESUMED");
    if (resumed.status !== "RESUMED") {
      return;
    }
    assertSafePublicPayload(resumed);
    expect(resumed.task.id).toBe(started.task.id);
    expect(sessions.count()).toBe(1);
    expect(tasks.listTaskIds()).toEqual([started.task.id]);
  });

  it("B. nested forbidden property names are still rejected", () => {
    const forbidden = [
      "answerKey",
      "correctOptionIds",
      "userId",
      "items",
      "needs",
      "evidence",
      "projection",
      "reason",
    ] as const;
    for (const key of forbidden) {
      const nested = startedEnvelope(publicTaskWithVisibleTokens());
      (nested.task as unknown as Record<string, unknown>).meta = {
        wrap: [{ [key]: "hidden" }],
      };
      expect(() => assertSafePublicPayload(nested), key).toThrow(
        new RegExp(`must not include ${key}`),
      );
    }
  });

  it("C. start/resume with visible word items stays loadable with one task", async () => {
    const lexemes = unseenLexemes(12);
    lexemes[0] = {
      ...lexemes[0],
      lemma: "items",
      display: "items",
      meaningsZh: ["items"],
    };
    const { controller, sessions, tasks } = createSessionHarness({ lexemes });
    const started = await controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(started.status).toBe("STARTED");
    if (started.status !== "STARTED") {
      return;
    }
    expect(JSON.stringify(started.task)).toContain("items");
    assertSafePublicPayload(started);
    const stored = await sessions.get(started.session.sessionId, USER_A);
    expect(stored?.state.currentTaskId).toBe(started.session.currentTaskId);
    const resumed = await controller.load(started.session.sessionId);
    expect(resumed.status).toBe("RESUMED");
    if (resumed.status !== "RESUMED") {
      return;
    }
    expect(resumed.task.id).toBe(started.task.id);
    expect(tasks.listTaskIds()).toEqual([started.task.id]);
  });

  it("EMPTY may keep a structural reason while STARTED may not", () => {
    expect(() =>
      assertSafePublicPayload({
        status: "EMPTY",
        source: "UNSEEN",
        requestedCount: 5,
        reason: "NO_ELIGIBLE_WORDS",
      }),
    ).not.toThrow();
    const started = startedEnvelope(publicTaskWithVisibleTokens());
    (started as { reason?: string }).reason = "NEW_WORD";
    expect(() => assertSafePublicPayload(started)).toThrow(/must not include reason/);
  });
});
