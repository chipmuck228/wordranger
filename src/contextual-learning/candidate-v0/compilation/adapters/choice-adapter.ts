import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";
import {
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
} from "@/domain/tasks/task-type";
import type { ResponseTransportCapability } from "../../capabilities/capability-registry";
import { CHOICE_COMPILER_ID } from "../../capabilities/capability-registry";
import { sameLexemeSense } from "../../domain/lexeme-sense";
import { DomainErrorCode } from "../../domain/errors";
import type { ChoiceExpectedResponse, SupportBlock } from "../../domain/types";
import type { FrozenSemanticProjection } from "../semantic-projection";
import { compileSupportHints } from "../support-hints";
import {
  compileFail,
  compileOk,
  type CompileResult,
  type TaskCompilationRequest,
} from "../types";
import {
  isChoiceExpectedResponse,
  validateExplicitChoice,
} from "../validate-answer-spec";

export interface ChoiceAdapterInput {
  request: TaskCompilationRequest;
  transport: ResponseTransportCapability;
  projection: FrozenSemanticProjection;
  supportBlocks?: ReadonlyMap<string, SupportBlock>;
  frozenLexemeId: string;
}

export interface MaterializedChoiceOption {
  id: string;
  text: string;
  lexemeId: string | null;
  correct: boolean;
}

/**
 * Copy author-declared candidates onto option drafts.
 * Correctness comes only from correctCandidateIds.
 */
export function materializeExplicitChoiceOptions(
  expected: ChoiceExpectedResponse,
): MaterializedChoiceOption[] {
  const correct = new Set(expected.correctCandidateIds);
  return expected.candidates.map((candidate) => ({
    id: candidate.id,
    text: candidate.displayText,
    lexemeId: candidate.lexemeRef?.lexemeId ?? null,
    correct: correct.has(candidate.id),
  }));
}

export function compileChoiceStep(input: ChoiceAdapterInput): CompileResult {
  const { request, transport, projection } = input;
  const expected = request.step.expectedResponse;
  if (!isChoiceExpectedResponse(expected)) {
    return compileFail(
      DomainErrorCode.COMPILATION_UNSUPPORTED_RESPONSE_KIND,
      `Choice adapter cannot encode ${expected.kind}`,
      "expectedResponse",
    );
  }

  const invalid = validateExplicitChoice(expected);
  if (invalid) {
    return invalid;
  }

  const drafts = materializeExplicitChoiceOptions(expected);
  if (transport.maxOptions && drafts.length > transport.maxOptions) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      `Choice has ${drafts.length} options; transport max is ${transport.maxOptions}`,
      "expectedResponse.candidates",
    );
  }

  if (expected.kind === "ENTITY_REF") {
    for (const candidate of expected.candidates) {
      const entity = request.resolvedContext.entityBindings.find(
        (binding) => binding.entityId === candidate.value,
      );
      if (!entity) {
        return compileFail(
          DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
          `ENTITY_REF candidate ${candidate.id} references unknown entity ${candidate.value}`,
          "expectedResponse.candidates",
        );
      }
      if (
        candidate.lexemeRef &&
        (entity.lexemeSenseBindings ?? []).length > 0 &&
        !(entity.lexemeSenseBindings ?? []).some((binding) =>
          sameLexemeSense(binding.sense, candidate.lexemeRef!),
        )
      ) {
        return compileFail(
          DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
          `ENTITY_REF candidate ${candidate.id} lexemeRef does not match the bound entity`,
          "expectedResponse.candidates",
        );
      }
    }
  }

  const createId = request.createId ?? fallbackId;
  const taskId = createId();
  const options = drafts.map((draft) => ({
    id: draft.id,
    content: { kind: "TEXT" as const, text: draft.text },
    lexemeId: draft.lexemeId,
    correct: draft.correct,
  }));

  const publicLearningTask: PublicLearningTask = {
    id: taskId,
    protocolVersion: TASK_PROTOCOL_VERSION,
    generatorVersion: TASK_GENERATOR_VERSION,
    learningNeedId: request.learningNeedId,
    lexemeId: input.frozenLexemeId,
    targetSkill: projection.targetSkill,
    taskType: projection.taskType,
    promptMode: projection.promptMode,
    answerMode: projection.answerMode,
    difficulty: 0.4,
    prompt: {
      kind: "MEANING_TEXT",
      text: request.step.promptIntent.instructionKey,
    },
    responseContract: {
      kind: "CHOICE",
      options: options.map(({ id, content }) => ({ id, content })),
    },
    hints: compileSupportHints(request.supportPolicy, input.supportBlocks),
    createdAt: request.now ?? "2026-09-17T00:00:00.000Z",
  };

  const optionLexemeIds: Record<string, string | null> = {};
  const correctOptionIds: string[] = [];
  for (const option of options) {
    optionLexemeIds[option.id] = option.lexemeId;
    if (option.correct) {
      correctOptionIds.push(option.id);
    }
  }

  const answerKey: TaskAnswerKey = {
    taskId,
    targetLexemeId: input.frozenLexemeId,
    correctOptionIds,
    optionLexemeIds,
    exactAcceptedTexts: options
      .filter((option) => option.correct)
      .map((option) => option.content.text),
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
      targetSenseIds: request.resolvedTargets.map((item) => item.sense.senseId),
      capabilityId: transport.id,
      compilerId: CHOICE_COMPILER_ID,
      sourceContentIds: [
        request.resolvedContext.contextFrameId,
        request.resolvedContext.skeletonId,
        ...request.resolvedTargets.map((item) => item.sense.senseId),
      ],
      semanticProjectionId: projection.id,
      senseProjection: {
        candidateSense: request.resolvedTargets[0]!.sense,
        frozenLexemeId: input.frozenLexemeId,
      },
    },
  });
}

let fallbackCounter = 0;

function fallbackId(): string {
  fallbackCounter += 1;
  return `candidate-v0-option-${fallbackCounter}`;
}
