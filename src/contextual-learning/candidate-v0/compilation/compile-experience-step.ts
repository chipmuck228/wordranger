import { findResponseTransport } from "../capabilities/capability-registry";
import { sameLexemeSense } from "../domain/lexeme-sense";
import { DomainErrorCode } from "../domain/errors";
import type { SupportBlock } from "../domain/types";
import { compileChoiceStep } from "./adapters/choice-adapter";
import { compileLexicalFormStep } from "./adapters/lexical-form-adapter";
import { assertFrozenPublicLearningTask } from "./frozen-task-guard";
import { findSemanticProjection } from "./semantic-projection";
import { validateSenseProjection } from "./sense-projection";
import { compileFail, type CompileResult, type TaskCompilationRequest } from "./types";
import { validateExplicitAnswerSpec } from "./validate-answer-spec";

export interface CompileExperienceStepOptions {
  supportBlocks?: ReadonlyMap<string, SupportBlock>;
}

/**
 * Compile one ExperienceStepSpec into a frozen PublicLearningTask.
 * Does not grade and does not update StudentLexemeModel.
 * Candidate V0 / Experimental / Not a Standard.
 */
export function compileExperienceStep(
  request: TaskCompilationRequest,
  options: CompileExperienceStepOptions = {},
): CompileResult {
  const stepError = validateStepStructure(request);
  if (stepError) {
    return stepError;
  }

  const snapshotError = validateSnapshotStructure(request);
  if (snapshotError) {
    return snapshotError;
  }

  const answerSpecError = validateExplicitAnswerSpec(request.step.expectedResponse);
  if (answerSpecError) {
    return answerSpecError;
  }

  const expectedKind = request.step.expectedResponse.kind;
  const transport = findResponseTransport(expectedKind);
  if (!transport) {
    return compileFail(
      expectedKind === "ORDERED_ENTITY_REFS"
        ? DomainErrorCode.COMPILATION_UNSUPPORTED_RESPONSE_KIND
        : DomainErrorCode.EXP_NO_RUNTIME_CAPABILITY,
      `Frozen runtime cannot transport ${expectedKind}`,
      "expectedResponse",
    );
  }

  const targetFocus = resolveTargetFocus(request);
  if (!targetFocus) {
    return compileFail(
      DomainErrorCode.EXP_TARGET_NOT_REACHABLE,
      "Compilation requires a resolved target with an explicit focus",
      "resolvedTargets",
    );
  }

  const projection = findSemanticProjection({
    semanticAction: request.step.semanticAction,
    responseKind: expectedKind,
    targetFocus,
    stepPurpose: request.step.purpose,
  });
  if (!projection) {
    return compileFail(
      DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH,
      `No frozen Evidence projection for ${request.step.semanticAction}/${expectedKind}/${targetFocus}/${request.step.purpose}`,
      "step",
    );
  }

  const expectedSense =
    request.step.expectedResponse.kind === "LEXICAL_FORM"
      ? request.step.expectedResponse.sense
      : request.resolvedTargets.find((item) => item.focus === targetFocus)?.sense ??
        request.resolvedTargets[0]?.sense;
  if (!expectedSense) {
    return compileFail(
      DomainErrorCode.EXP_TARGET_NOT_REACHABLE,
      "Compilation requires a target LexemeSenseRef",
      "resolvedTargets",
    );
  }

  const senseProjection = validateSenseProjection({
    expectedSense,
    resolvedTargets: request.resolvedTargets,
    resolvedContext: request.resolvedContext,
  });
  if (!senseProjection.ok) {
    return compileFail(
      senseProjection.error.code,
      senseProjection.error.message,
      senseProjection.error.path,
    );
  }

  const compiled =
    expectedKind === "LEXICAL_FORM"
      ? compileLexicalFormStep({
          request,
          transport,
          projection,
          senseProjection: senseProjection.value,
          supportBlocks: options.supportBlocks,
        })
      : compileChoiceStep({
          request,
          transport,
          projection,
          supportBlocks: options.supportBlocks,
          frozenLexemeId: senseProjection.value.frozenLexemeId,
        });

  if (!compiled.ok) {
    return compiled;
  }

  const mismatch = assertFrozenPublicLearningTask(compiled.value.publicLearningTask);
  if (mismatch) {
    return mismatch;
  }

  if (compiled.value.answerKey.taskId !== compiled.value.publicLearningTask.id) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "AnswerKey.taskId must match PublicLearningTask.id",
      "answerKey",
    );
  }
  if (compiled.value.publicLearningTask.lexemeId !== expectedSense.lexemeId) {
    return compileFail(
      DomainErrorCode.COMPILATION_AMBIGUOUS_SENSE_PROJECTION,
      "PublicLearningTask.lexemeId must equal the candidate sense lexemeId",
      "publicLearningTask.lexemeId",
    );
  }
  if (compiled.value.answerKey.targetLexemeId !== expectedSense.lexemeId) {
    return compileFail(
      DomainErrorCode.COMPILATION_AMBIGUOUS_SENSE_PROJECTION,
      "TaskAnswerKey.targetLexemeId must equal the candidate sense lexemeId",
      "answerKey.targetLexemeId",
    );
  }
  if (compiled.value.publicLearningTask.taskType !== projection.taskType) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "Compiled taskType does not match the semantic projection",
      "publicLearningTask.taskType",
    );
  }
  if (compiled.value.publicLearningTask.targetSkill !== projection.targetSkill) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "Compiled targetSkill does not match the semantic projection",
      "publicLearningTask.targetSkill",
    );
  }
  if (!compiled.value.trace.semanticProjectionId) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "CompilationTrace must record semanticProjectionId",
      "trace.semanticProjectionId",
    );
  }

  return compiled;
}

function validateStepStructure(request: TaskCompilationRequest): CompileResult | null {
  if (!request.step.id || !request.step.semanticAction || !request.step.purpose) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "ExperienceStep is missing identity, action, or purpose",
      "step",
    );
  }
  if (!request.step.expectedResponse?.kind) {
    return compileFail(
      DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
      "ExperienceStep is missing expectedResponse",
      "expectedResponse",
    );
  }
  return null;
}

function validateSnapshotStructure(
  request: TaskCompilationRequest,
): CompileResult | null {
  if (
    !request.resolvedContext.contextFrameId ||
    !request.resolvedContext.skeletonId
  ) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "ResolvedContextSnapshot is missing frame or skeleton identity",
      "resolvedContext",
    );
  }
  return null;
}

function resolveTargetFocus(request: TaskCompilationRequest) {
  const expected = request.step.expectedResponse;
  if (expected.kind === "LEXICAL_FORM") {
    const matched = request.resolvedTargets.find((item) =>
      sameLexemeSense(item.sense, expected.sense),
    );
    return matched?.focus ?? request.resolvedTargets[0]?.focus;
  }
  return request.resolvedTargets[0]?.focus;
}
