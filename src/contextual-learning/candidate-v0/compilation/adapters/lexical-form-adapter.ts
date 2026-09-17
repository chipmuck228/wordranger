import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";
import {
  LearningTaskType,
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
} from "@/domain/tasks/task-type";
import { LEXICAL_FORM_COMPILER_ID } from "../../capabilities/capability-registry";
import { DomainErrorCode } from "../../domain/errors";
import type { RuntimeCapability, SupportBlock } from "../../domain/types";
import { compileSupportHints } from "../support-hints";
import {
  compileFail,
  compileOk,
  type CompileResult,
  type TaskCompilationRequest,
} from "../types";

export interface LexicalFormAdapterInput {
  request: TaskCompilationRequest;
  capability: RuntimeCapability;
  supportBlocks?: ReadonlyMap<string, SupportBlock>;
}

export function compileLexicalFormStep(
  input: LexicalFormAdapterInput,
): CompileResult {
  const { request, capability } = input;
  const expected = request.step.expectedResponse;
  if (expected.kind !== "LEXICAL_FORM") {
    return compileFail(
      DomainErrorCode.COMPILATION_UNSUPPORTED_RESPONSE_KIND,
      `Lexical-form adapter cannot encode ${expected.kind}`,
      "expectedResponse",
    );
  }

  const target =
    request.resolvedTargets.find(
      (item) => item.sense.senseId === expected.sense.senseId,
    ) ?? request.resolvedTargets[0];
  if (!target) {
    return compileFail(
      DomainErrorCode.EXP_TARGET_NOT_REACHABLE,
      "Lexical-form compilation requires a resolved target",
      "resolvedTargets",
    );
  }

  const form = target.displayForm.trim();
  if (!form) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "Lexical-form target is missing a display form",
      "resolvedTargets",
    );
  }

  if (
    request.step.promptIntent.mustNotRevealTargetForm &&
    request.step.promptIntent.instructionKey
      .toLowerCase()
      .includes(form.toLowerCase())
  ) {
    return compileFail(
      DomainErrorCode.EXP_RECALL_LEAKS_ANSWER,
      "Compiled RECALL prompt reveals the target form",
      "promptIntent",
    );
  }

  const createId = request.createId ?? (() => `candidate-v0-text-${target.sense.senseId}`);
  const taskId = createId();

  const publicLearningTask: PublicLearningTask = {
    id: taskId,
    protocolVersion: TASK_PROTOCOL_VERSION,
    generatorVersion: TASK_GENERATOR_VERSION,
    learningNeedId: request.learningNeedId,
    lexemeId: expected.sense.lexemeId,
    targetSkill: VocabularySkill.ACTIVE_RECALL,
    taskType: LearningTaskType.ACTIVE_RECALL_TYPING,
    promptMode: PromptMode.MEANING_TO_WORD,
    answerMode: AnswerMode.TYPING,
    difficulty: 0.5,
    prompt: {
      kind: "MEANING_TEXT",
      text: request.step.promptIntent.instructionKey,
    },
    responseContract: {
      kind: "TEXT_INPUT",
      placeholder: "Type the English word",
      maxLength: 64,
    },
    hints: compileSupportHints(request.supportPolicy, input.supportBlocks),
    createdAt: request.now ?? "2026-09-17T00:00:00.000Z",
  };

  const answerKey: TaskAnswerKey = {
    taskId,
    targetLexemeId: expected.sense.lexemeId,
    correctOptionIds: [],
    optionLexemeIds: {},
    exactAcceptedTexts: [form],
    semanticAcceptedTexts: [],
  };

  return compileOk({
    stepId: request.step.id,
    publicLearningTask,
    answerKey,
    trace: {
      experienceId: request.experienceId,
      stepId: request.step.id,
      contextFrameId: request.resolvedContext.contextFrameId,
      skeletonId: request.resolvedContext.skeletonId,
      targetSenseIds: [expected.sense.senseId],
      capabilityId: capability.id,
      compilerId: LEXICAL_FORM_COMPILER_ID,
      sourceContentIds: [
        request.resolvedContext.contextFrameId,
        expected.sense.senseId,
      ],
    },
  });
}
