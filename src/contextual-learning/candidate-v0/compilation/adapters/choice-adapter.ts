import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";
import { LearningTaskType, TASK_GENERATOR_VERSION, TASK_PROTOCOL_VERSION } from "@/domain/tasks/task-type";
import { CHOICE_COMPILER_ID } from "../../capabilities/capability-registry";
import { serializePredicate } from "../../domain/predicates";
import type { RuntimeCapability } from "../../domain/types";
import { DomainErrorCode } from "../../domain/errors";
import { compileSupportHints } from "../support-hints";
import {
  compileFail,
  compileOk,
  type CompileResult,
  type TaskCompilationRequest,
} from "../types";
import type { SupportBlock } from "../../domain/types";

export interface ChoiceAdapterInput {
  request: TaskCompilationRequest;
  capability: RuntimeCapability;
  supportBlocks?: ReadonlyMap<string, SupportBlock>;
}

interface ChoiceOptionDraft {
  id: string;
  text: string;
  lexemeId: string | null;
  correct: boolean;
}

export function compileChoiceStep(input: ChoiceAdapterInput): CompileResult {
  const { request, capability } = input;
  const drafts = buildOptions(request);
  if (drafts === null) {
    return compileFail(
      DomainErrorCode.COMPILATION_UNSUPPORTED_RESPONSE_KIND,
      `Choice adapter cannot encode ${request.step.expectedResponse.kind}`,
      "expectedResponse",
    );
  }
  if (!drafts.some((option) => option.correct)) {
    return compileFail(
      DomainErrorCode.COMPILATION_MISSING_CORRECT_OPTION,
      "Compiled choice has no correct option",
      "expectedResponse",
    );
  }
  if (drafts.length < 2) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "Need at least one distractor to emit a frozen CHOICE task",
      "expectedResponse",
    );
  }

  const createId = request.createId ?? fallbackId;
  const taskId = createId();
  const target = request.resolvedTargets[0];
  if (!target) {
    return compileFail(
      DomainErrorCode.EXP_TARGET_NOT_REACHABLE,
      "Choice compilation requires a resolved target",
      "resolvedTargets",
    );
  }

  const options = drafts.map((draft) => ({
    id: draft.id || createId(),
    content: { kind: "TEXT" as const, text: draft.text },
    lexemeId: draft.lexemeId,
    correct: draft.correct,
  }));

  const publicLearningTask: PublicLearningTask = {
    id: taskId,
    protocolVersion: TASK_PROTOCOL_VERSION,
    generatorVersion: TASK_GENERATOR_VERSION,
    learningNeedId: request.learningNeedId,
    lexemeId: target.sense.lexemeId,
    targetSkill: VocabularySkill.MEANING_RECOGNITION,
    taskType: LearningTaskType.MEANING_CHOICE,
    promptMode: PromptMode.CONTEXT_TO_WORD,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
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
    targetLexemeId: target.sense.lexemeId,
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
      capabilityId: capability.id,
      compilerId: CHOICE_COMPILER_ID,
      sourceContentIds: [
        request.resolvedContext.contextFrameId,
        request.resolvedContext.skeletonId,
        ...request.resolvedTargets.map((item) => item.sense.senseId),
      ],
    },
  });
}

function buildOptions(request: TaskCompilationRequest): ChoiceOptionDraft[] | null {
  const expected = request.step.expectedResponse;
  const createId = request.createId ?? fallbackId;
  const target = request.resolvedTargets[0];

  if (expected.kind === "ENTITY_REF") {
    return expected.allowedEntityIds.map((entityId) => {
      const entity = request.resolvedContext.entityBindings.find(
        (binding) => binding.entityId === entityId,
      );
      const bindsTarget = (entity?.lexemeSenseBindings ?? []).some(
        (binding) => binding.sense.senseId === target?.sense.senseId,
      );
      return {
        id: createId(),
        text: entity?.label ?? entityId,
        lexemeId: entity?.lexemeSenseBindings?.[0]?.sense.lexemeId ?? null,
        correct: bindsTarget,
      };
    });
  }

  if (expected.kind === "RELATION_CHOICE") {
    return expected.allowedRelationIds.map((relationId) => {
      const matchesTarget = request.resolvedTargets.some((item) =>
        (item.focus === "RELATION_USE" || item.focus === "DISCRIMINATION") &&
        relationId.toLowerCase().includes(
          displayToken(item.displayForm),
        ),
      ) || relationMatchesSense(relationId, target?.sense.senseId ?? "");
      return {
        id: createId(),
        text: relationId,
        lexemeId: matchesTarget ? (target?.sense.lexemeId ?? null) : null,
        correct: matchesTarget,
      };
    });
  }

  if (expected.kind === "SEMANTIC_CLASS") {
    return expected.allowedConceptIds.map((conceptId) => {
      const matches = request.resolvedTargets.some((item) =>
        conceptId.toLowerCase().includes(displayToken(item.displayForm)),
      ) || conceptId.includes(target?.sense.senseId ?? "___none");
      return {
        id: createId(),
        text: conceptId,
        lexemeId: matches ? (target?.sense.lexemeId ?? null) : null,
        correct: matches,
      };
    });
  }

  if (expected.kind === "CLAIM_CHOICE") {
    return expected.allowedPredicates.map((predicate) => ({
      id: createId(),
      text: serializePredicate(predicate),
      lexemeId: predicate.expected ? (target?.sense.lexemeId ?? null) : null,
      correct: predicate.expected,
    }));
  }

  return null;
}

function relationMatchesSense(relationId: string, senseId: string): boolean {
  if (!senseId) {
    return false;
  }
  const token = senseId.split("#")[0]?.toLowerCase() ?? "";
  return relationId.toLowerCase().includes(token);
}

function displayToken(displayForm: string | undefined): string {
  return (displayForm ?? "").toLowerCase();
}

let fallbackCounter = 0;

function fallbackId(): string {
  fallbackCounter += 1;
  return `candidate-v0-option-${fallbackCounter}`;
}
