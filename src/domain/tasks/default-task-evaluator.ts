import {
  EvidenceErrorType,
  EvidenceOutcome,
} from "@/domain/learning/evidence.types";
import type { PublicLearningTask } from "./public-learning-task";
import type { StudentAction } from "./student-action";
import type { TaskAnswerKey } from "./task-answer-key";
import type { TaskEvaluation } from "./task-evaluation";
import {
  DEFAULT_TASK_EVALUATION_POLICY,
  type TaskEvaluationPolicy,
} from "./task-evaluation-policy";
import { TaskProtocolError, type TaskEvaluator } from "./task-evaluator";
import { LearningTaskType } from "./task-type";
import { levenshteinDistance, normalizeStudentText } from "./text-normalization";

function successOutcome(hintCount: number): EvidenceOutcome {
  return hintCount > 0
    ? EvidenceOutcome.ASSISTED_CORRECT
    : EvidenceOutcome.INDEPENDENT_CORRECT;
}

export class DefaultTaskEvaluator implements TaskEvaluator {
  constructor(
    private readonly policy: TaskEvaluationPolicy = DEFAULT_TASK_EVALUATION_POLICY,
  ) {}

  evaluate(
    task: PublicLearningTask,
    answerKey: TaskAnswerKey,
    action: StudentAction,
  ): TaskEvaluation {
    if (action.taskId !== task.id) {
      throw new TaskProtocolError(
        "TASK_ID_MISMATCH",
        `Action taskId ${action.taskId} does not match task ${task.id}`,
      );
    }
    if (answerKey.taskId !== task.id) {
      throw new TaskProtocolError(
        "ANSWER_KEY_MISMATCH",
        `Answer key taskId ${answerKey.taskId} does not match task ${task.id}`,
      );
    }

    const base = {
      taskId: task.id,
      lexemeId: task.lexemeId,
      skill: task.targetSkill,
      responseTimeMs: action.responseTimeMs,
      hintCount: action.hintCount,
      occurredAt: action.occurredAt,
      expectedAnswer:
        answerKey.exactAcceptedTexts[0] ??
        (task.responseContract.kind === "CHOICE"
          ? (task.responseContract.options.find((option) =>
              answerKey.correctOptionIds.includes(option.id),
            )?.content.text ?? null)
          : null),
    };

    if (action.kind === "SKIP") {
      return {
        ...base,
        outcome: EvidenceOutcome.SKIPPED,
        errorType: null,
        selectedLexemeId: null,
        typedAnswer: null,
        normalizedTypedAnswer: null,
        isCorrect: false,
      };
    }

    if (action.kind === "TIMEOUT") {
      return {
        ...base,
        outcome: EvidenceOutcome.TIMEOUT,
        errorType: EvidenceErrorType.TIMEOUT,
        selectedLexemeId: null,
        typedAnswer: null,
        normalizedTypedAnswer: null,
        isCorrect: false,
      };
    }

    if (task.responseContract.kind === "CHOICE") {
      if (action.kind !== "CHOICE") {
        throw new TaskProtocolError(
          "ACTION_CONTRACT_MISMATCH",
          "CHOICE task requires a CHOICE action",
        );
      }
      const optionIds = task.responseContract.options.map((option) => option.id);
      if (!optionIds.includes(action.optionId)) {
        throw new TaskProtocolError(
          "INVALID_OPTION_ID",
          `Option ${action.optionId} is not part of this task`,
        );
      }
      const isCorrect = answerKey.correctOptionIds.includes(action.optionId);
      const selectedLexemeId = answerKey.optionLexemeIds[action.optionId] ?? null;
      const confusionIds = answerKey.confusionLexemeIds ?? [];
      let errorType: EvidenceErrorType | null = null;
      if (!isCorrect) {
        errorType =
          selectedLexemeId && confusionIds.includes(selectedLexemeId)
            ? EvidenceErrorType.CONFUSED_WITH_WORD
            : task.taskType === LearningTaskType.RELATION_CHOICE
              ? EvidenceErrorType.WRONG_SEMANTIC_RELATION
              : EvidenceErrorType.WRONG_MEANING;
      }
      return {
        ...base,
        outcome: isCorrect
          ? successOutcome(action.hintCount)
          : EvidenceOutcome.INCORRECT,
        errorType,
        selectedLexemeId,
        typedAnswer: null,
        normalizedTypedAnswer: null,
        isCorrect,
      };
    }

    if (action.kind !== "TEXT_INPUT") {
      throw new TaskProtocolError(
        "ACTION_CONTRACT_MISMATCH",
        "TEXT_INPUT task requires a TEXT_INPUT action",
      );
    }

    const normalized = normalizeStudentText(action.value, this.policy);
    const accepted = answerKey.exactAcceptedTexts.map((text) =>
      normalizeStudentText(text, this.policy),
    );
    const isCorrect = accepted.includes(normalized);
    let errorType: EvidenceErrorType | null = null;
    if (!isCorrect && task.taskType === LearningTaskType.SPELLING_RECALL_TYPING) {
      const distance = Math.min(
        ...accepted.map((text) => levenshteinDistance(normalized, text)),
        Number.POSITIVE_INFINITY,
      );
      errorType =
        distance <= this.policy.spelling.minorEditDistance
          ? EvidenceErrorType.SPELLING_MINOR
          : EvidenceErrorType.SPELLING_MAJOR;
    } else if (!isCorrect) {
      errorType = EvidenceErrorType.UNKNOWN;
    }

    return {
      ...base,
      outcome: isCorrect
        ? successOutcome(action.hintCount)
        : EvidenceOutcome.INCORRECT,
      errorType,
      selectedLexemeId: isCorrect ? task.lexemeId : null,
      typedAnswer: action.value,
      normalizedTypedAnswer: normalized,
      isCorrect,
    };
  }
}
