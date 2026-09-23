/**
 * Candidate V0 / Experimental / Not a Standard.
 * Explicit intent first. Compile failure never becomes guided.
 */

import { findSemanticProjection } from "../compilation/semantic-projection";
import { DomainErrorCode } from "../domain/errors";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type {
  AssessableExperienceStepSpec,
  ExperienceStepSpec,
  GuidedActivityKind,
  ResolvedTargetSnapshot,
} from "../domain/types";
import { isAssessableExperienceStep, isGuidedExperienceStep } from "../domain/types";

export type StepExecutionClassification =
  | {
      kind: "ASSESSABLE_FROZEN_TASK";
      semanticProjectionId: string;
    }
  | {
      kind: "GUIDED_ACTIVITY";
      guidedActivityKind: GuidedActivityKind;
      rationale: string;
    }
  | {
      kind: "UNSUPPORTED";
      reasonCode: string;
      rationale: string;
    };

export function classifyExperienceStep(input: {
  step: ExperienceStepSpec;
  resolvedTargets: readonly ResolvedTargetSnapshot[];
}): StepExecutionClassification {
  const { step, resolvedTargets } = input;
  if (isGuidedExperienceStep(step)) {
    return {
      kind: "GUIDED_ACTIVITY",
      guidedActivityKind: step.executionIntent.guidedActivityKind,
      rationale: step.executionIntent.rationale,
    };
  }
  if (!isAssessableExperienceStep(step)) {
    return {
      kind: "UNSUPPORTED",
      reasonCode: DomainErrorCode.EXP_INVALID_STEP_INTENT,
      rationale: "Step executionIntent is missing or not explicit",
    };
  }
  return classifyAssessableStep(step, resolvedTargets);
}

function classifyAssessableStep(
  step: AssessableExperienceStepSpec,
  resolvedTargets: readonly ResolvedTargetSnapshot[],
): StepExecutionClassification {
  const targetFocus = resolveAssessableFocus(step, resolvedTargets);
  if (!targetFocus) {
    return {
      kind: "UNSUPPORTED",
      reasonCode: DomainErrorCode.EXP_TARGET_NOT_REACHABLE,
      rationale: "Assessable step has no resolved target focus",
    };
  }
  const projection = findSemanticProjection({
    semanticAction: step.semanticAction,
    responseKind: step.expectedResponse.kind,
    targetFocus,
    stepPurpose: step.purpose,
  });
  if (!projection) {
    return {
      kind: "UNSUPPORTED",
      reasonCode: DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH,
      rationale: `Assessable ${step.semanticAction}/${step.expectedResponse.kind}/${targetFocus}/${step.purpose} has no frozen Evidence projection`,
    };
  }
  return {
    kind: "ASSESSABLE_FROZEN_TASK",
    semanticProjectionId: projection.id,
  };
}

function resolveAssessableFocus(
  step: AssessableExperienceStepSpec,
  resolvedTargets: readonly ResolvedTargetSnapshot[],
) {
  const expected = step.expectedResponse;
  if (expected.kind === "LEXICAL_FORM") {
    const matched = resolvedTargets.find((item) =>
      sameLexemeSense(item.sense, expected.sense),
    );
    return matched?.focus ?? resolvedTargets[0]?.focus;
  }
  return resolvedTargets[0]?.focus;
}
