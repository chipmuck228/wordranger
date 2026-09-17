import { findFrozenCapability } from "../capabilities/capability-registry";
import { DomainErrorCode } from "../domain/errors";
import type { SupportBlock } from "../domain/types";
import { compileChoiceStep } from "./adapters/choice-adapter";
import { compileLexicalFormStep } from "./adapters/lexical-form-adapter";
import { assertFrozenPublicLearningTask } from "./frozen-task-guard";
import { compileFail, type CompileResult, type TaskCompilationRequest } from "./types";

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
  const expectedKind = request.step.expectedResponse.kind;
  if (expectedKind === "ORDERED_ENTITY_REFS") {
    return compileFail(
      DomainErrorCode.COMPILATION_UNSUPPORTED_RESPONSE_KIND,
      "ORDERED_ENTITY_REFS has no frozen PublicLearningTask contract",
      "expectedResponse",
    );
  }

  const capability = findFrozenCapability(
    request.step.semanticAction,
    expectedKind,
  );
  if (!capability) {
    return compileFail(
      DomainErrorCode.EXP_NO_RUNTIME_CAPABILITY,
      `Frozen runtime cannot host ${request.step.semanticAction}/${expectedKind}`,
      "requiredCapabilities",
    );
  }

  const compiled =
    expectedKind === "LEXICAL_FORM"
      ? compileLexicalFormStep({
          request,
          capability,
          supportBlocks: options.supportBlocks,
        })
      : compileChoiceStep({
          request,
          capability,
          supportBlocks: options.supportBlocks,
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

  return compiled;
}
