import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { DomainErrorCode } from "../domain/errors";
import { compileFail, type CompileResult } from "./types";

const FROZEN_RESPONSE_KINDS = new Set(["CHOICE", "TEXT_INPUT"]);

/**
 * Confirms the compiler emitted a real frozen PublicLearningTask shape.
 * Does not redefine the type.
 */
export function assertFrozenPublicLearningTask(
  task: PublicLearningTask,
): CompileResult | null {
  if (!task.id || !task.lexemeId || !task.learningNeedId) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "Compiled task is missing frozen identity fields",
      "publicLearningTask",
    );
  }
  if (!task.protocolVersion || !task.generatorVersion || !task.createdAt) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "Compiled task is missing frozen protocol fields",
      "publicLearningTask",
    );
  }
  if (!FROZEN_RESPONSE_KINDS.has(task.responseContract.kind)) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      `Frozen runtime does not accept response ${task.responseContract.kind}`,
      "publicLearningTask.responseContract",
    );
  }
  if (
    task.responseContract.kind === "CHOICE" &&
    task.responseContract.options.length < 2
  ) {
    return compileFail(
      DomainErrorCode.COMPILATION_FROZEN_CONTRACT_MISMATCH,
      "CHOICE tasks need at least two options",
      "publicLearningTask.responseContract.options",
    );
  }
  return null;
}
