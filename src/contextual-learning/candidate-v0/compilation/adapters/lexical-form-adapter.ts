import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";
import {
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
} from "@/domain/tasks/task-type";
import type { ResponseTransportCapability } from "../../capabilities/capability-registry";
import { LEXICAL_FORM_COMPILER_ID } from "../../capabilities/capability-registry";
import { sameLexemeSense } from "../../domain/lexeme-sense";
import { DomainErrorCode } from "../../domain/errors";
import type { SupportBlock } from "../../domain/types";
import type { FrozenSemanticProjection } from "../semantic-projection";
import type { SenseProjectionOk } from "../sense-projection";
import { compileSupportHints } from "../support-hints";
import {
  compileFail,
  compileOk,
  type CompileResult,
  type TaskCompilationRequest,
} from "../types";

export interface LexicalFormAdapterInput {
  request: TaskCompilationRequest;
  transport: ResponseTransportCapability;
  projection: FrozenSemanticProjection;
  senseProjection: SenseProjectionOk;
  supportBlocks?: ReadonlyMap<string, SupportBlock>;
}

export function compileLexicalFormStep(
  input: LexicalFormAdapterInput,
): CompileResult {
  const { request, transport, projection, senseProjection } = input;
  const expected = request.step.expectedResponse;
  if (expected.kind !== "LEXICAL_FORM") {
    return compileFail(
      DomainErrorCode.COMPILATION_UNSUPPORTED_RESPONSE_KIND,
      `Lexical-form adapter cannot encode ${expected.kind}`,
      "expectedResponse",
    );
  }

  if (!sameLexemeSense(expected.sense, senseProjection.target.sense)) {
    return compileFail(
      DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH,
      "Lexical-form expected sense does not match the projected target",
      "expectedResponse.sense",
    );
  }

  const form = senseProjection.target.displayForm.trim();
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

  const frozenLexemeId = senseProjection.frozenLexemeId;
  if (
    expected.sense.lexemeId !== frozenLexemeId ||
    senseProjection.target.sense.lexemeId !== frozenLexemeId
  ) {
    return compileFail(
      DomainErrorCode.COMPILATION_AMBIGUOUS_SENSE_PROJECTION,
      "PublicLearningTask.lexemeId must equal the target sense lexemeId",
      "expectedResponse.sense",
    );
  }

  const createId =
    request.createId ??
    (() => `candidate-v0-text-${expected.sense.lexemeId}::${expected.sense.senseId}`);
  const taskId = createId();

  const publicLearningTask: PublicLearningTask = {
    id: taskId,
    protocolVersion: TASK_PROTOCOL_VERSION,
    generatorVersion: TASK_GENERATOR_VERSION,
    learningNeedId: request.learningNeedId,
    lexemeId: frozenLexemeId,
    targetSkill: projection.targetSkill,
    taskType: projection.taskType,
    promptMode: projection.promptMode,
    answerMode: projection.answerMode,
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
    targetLexemeId: frozenLexemeId,
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
      capabilityId: transport.id,
      compilerId: LEXICAL_FORM_COMPILER_ID,
      sourceContentIds: [
        request.resolvedContext.contextFrameId,
        `${expected.sense.lexemeId}::${expected.sense.senseId}`,
      ],
      semanticProjectionId: projection.id,
      senseProjection: {
        candidateSense: expected.sense,
        frozenLexemeId,
      },
    },
  });
}
