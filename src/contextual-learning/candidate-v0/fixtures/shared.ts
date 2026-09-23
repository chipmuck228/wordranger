/**
 * Candidate V0 / Experimental / Not a Standard.
 */

import { curatedFixtureProvenance } from "../domain/provenance";
import { findProfile, lexemeSenseKey } from "../domain/lexeme-sense";
import type {
  AssessableExperienceStepSpec,
  ExperienceCompletionPolicy,
  ExperienceStepSpec,
  ExplicitSemanticChoice,
  LexemeSenseRef,
  SemanticChoiceCandidate,
  SemanticFact,
  SemanticPredicate,
  SenseSemanticProfile,
  StepSupportPolicy,
  StepTransitionPolicy,
  SupportBlock,
  SupportLevel,
} from "../domain/types";

export const FIXTURE_PROVENANCE = curatedFixtureProvenance(
  "docs/CONTEXTUAL_LEARNING_DOMAIN_MODEL_CANDIDATE_V0.md",
);

export function sense(lexemeId: string, senseId: string): LexemeSenseRef {
  return { lexemeId, senseId };
}

export function fact(
  predicate: string,
  args: SemanticFact["arguments"],
  id?: string,
): SemanticFact {
  return id
    ? { id, predicate, arguments: args, truth: true }
    : { predicate, arguments: args, truth: true };
}

export function pred(
  predicate: string,
  args: SemanticPredicate["arguments"],
  expected = true,
): SemanticPredicate {
  return { predicate, arguments: args, expected };
}

export function entityArg(entityId: string): SemanticFact["arguments"][number] {
  return { kind: "ENTITY", entityId };
}

export function roleArg(roleId: string): SemanticFact["arguments"][number] {
  return { kind: "ROLE", roleId };
}

export function conceptArg(
  conceptId: string,
): SemanticFact["arguments"][number] {
  return { kind: "CONCEPT", conceptId };
}

export function literalArg(
  value: string | number | boolean,
): SemanticFact["arguments"][number] {
  return { kind: "LITERAL", value };
}

export function profile(
  ref: LexemeSenseRef,
  displayForm: string,
  expresses: string[],
): SenseSemanticProfile {
  return {
    sense: ref,
    displayForm,
    expresses,
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  };
}

export function assessable(
  step: Omit<AssessableExperienceStepSpec, "executionIntent">,
): AssessableExperienceStepSpec {
  return {
    ...step,
    executionIntent: { kind: "ASSESSABLE" },
  };
}

export function nextOrEnd(end: boolean): StepTransitionPolicy {
  return {
    onTaskCompleted: end ? "END" : "NEXT",
    onSupportExhausted: end ? "END" : "NEXT",
  };
}

export const MINIMAL_SUPPORT: StepSupportPolicy = {
  initialSupportBlockIds: [],
  ladder: [
    {
      level: 0,
      trigger: "ON_REQUEST",
      supportBlockIds: [],
      permitsAnotherAttempt: true,
    },
  ],
};

export function strengthenLadder(ids: {
  functionCue: string;
  contrast: string;
  partial: string;
  answer: string;
}): SupportLevel[] {
  return [
    {
      level: 0,
      trigger: "ON_REQUEST",
      supportBlockIds: [],
      permitsAnotherAttempt: true,
    },
    {
      level: 1,
      trigger: "AFTER_FAILED_ATTEMPT",
      supportBlockIds: [ids.functionCue],
      permitsAnotherAttempt: true,
    },
    {
      level: 2,
      trigger: "AFTER_FAILED_ATTEMPT",
      supportBlockIds: [ids.contrast],
      permitsAnotherAttempt: true,
    },
    {
      level: 3,
      trigger: "AFTER_N_FAILURES",
      supportBlockIds: [ids.partial],
      permitsAnotherAttempt: true,
    },
    {
      level: 4,
      trigger: "ON_REQUEST",
      supportBlockIds: [ids.answer],
      permitsAnotherAttempt: false,
    },
  ];
}

export function completeAll(steps: ExperienceStepSpec[]): ExperienceCompletionPolicy {
  return {
    requiredStepIds: steps.map((step) => step.id),
    terminalStepIds: [steps[steps.length - 1]?.id ?? ""],
    onCompilationFailure: "ABORT_PLAN",
  };
}

export function textSupport(
  id: string,
  text: string,
  revealCost: SupportBlock["revealCost"],
  targetSenseIds: string[],
): SupportBlock {
  return {
    id,
    type: revealCost === "ANSWER_REVEALING" ? "HINT" : "HINT",
    appliesToModes: ["PROBE", "BUILD", "STRENGTHEN", "RETRIEVE"],
    targetSenseIds,
    content: { kind: "TEXT", text },
    revealCost,
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  };
}

export function supportMap(
  blocks: SupportBlock[],
): Map<string, SupportBlock> {
  return new Map(blocks.map((block) => [block.id, block]));
}

export function profileMap(
  profiles: SenseSemanticProfile[],
): Map<string, SenseSemanticProfile> {
  return new Map(profiles.map((item) => [lexemeSenseKey(item.sense), item]));
}

export { findProfile };

export function explicitChoice<TValue>(
  candidates: SemanticChoiceCandidate<TValue>[],
  correctCandidateIds: string[],
): ExplicitSemanticChoice<TValue> {
  return { candidates, correctCandidateIds };
}
