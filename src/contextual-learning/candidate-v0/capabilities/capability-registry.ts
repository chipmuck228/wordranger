/**
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Capabilities are registered from the real frozen PublicLearningTask
 * and evaluator surface, not from assumed contextual runtimes.
 *
 * Frozen runtime facts used here:
 * - PublicLearningTask.responseContract is CHOICE | TEXT_INPUT only
 * - the frozen evaluator grades optionId or normalized typed text
 * - PublicTaskHint exists as { id, text }; the frozen generator currently emits []
 * - hintCount > 0 becomes ASSISTED_CORRECT; there is no Level 0–4 evidence field
 * - one PublicLearningTask carries one lexemeId
 * - CONTEXT_USE and LISTENING_RECOGNITION stay unavailable as skills
 */

import type { RuntimeCapability, SemanticAction } from "../domain/types";

export const CHOICE_COMPILER_ID = "candidate-v0-choice-adapter";
export const LEXICAL_FORM_COMPILER_ID = "candidate-v0-lexical-form-adapter";

const CHOICE_ACTIONS: readonly SemanticAction[] = [
  "IDENTIFY",
  "SELECT",
  "DISTINGUISH",
  "CLASSIFY",
  "COMPARE",
  "CONNECT",
  "OBSERVE",
  "PREDICT",
];

const TYPE_ACTIONS: readonly SemanticAction[] = ["TYPE", "RECALL"];

function frozenChoiceCapability(action: SemanticAction): RuntimeCapability {
  return {
    id: `frozen-choice:${action}`,
    supportsAction: action,
    responseKinds: [
      "ENTITY_REF",
      "RELATION_CHOICE",
      "SEMANTIC_CLASS",
      "CLAIM_CHOICE",
    ],
    maxOptions: 6,
    supportsContextSnapshot: false,
    supportsHintReveal: true,
    compilerId: CHOICE_COMPILER_ID,
  };
}

function frozenTypingCapability(action: SemanticAction): RuntimeCapability {
  return {
    id: `frozen-text-input:${action}`,
    supportsAction: action,
    responseKinds: ["LEXICAL_FORM"],
    supportsContextSnapshot: false,
    supportsHintReveal: true,
    compilerId: LEXICAL_FORM_COMPILER_ID,
  };
}

export const FROZEN_RUNTIME_CAPABILITIES: readonly RuntimeCapability[] = [
  ...CHOICE_ACTIONS.map(frozenChoiceCapability),
  ...TYPE_ACTIONS.map(frozenTypingCapability),
];

export function listFrozenRuntimeCapabilities(): readonly RuntimeCapability[] {
  return FROZEN_RUNTIME_CAPABILITIES;
}

export function findFrozenCapability(
  action: SemanticAction,
  responseKind: RuntimeCapability["responseKinds"][number],
): RuntimeCapability | undefined {
  return FROZEN_RUNTIME_CAPABILITIES.find(
    (capability) =>
      capability.supportsAction === action &&
      capability.responseKinds.includes(responseKind),
  );
}

export const FROZEN_RUNTIME_GAPS = [
  {
    id: "ORDERED_ENTITY_REFS",
    reason:
      "PublicLearningTask has no ordered-sequence contract; evaluator only accepts CHOICE or TEXT_INPUT",
  },
  {
    id: "CONTEXT_SNAPSHOT_ON_TASK",
    reason:
      "PublicLearningTask cannot carry ResolvedContextSnapshot; compiler flattens prompt text",
  },
  {
    id: "SUPPORT_LADDER_EVIDENCE",
    reason:
      "LearningEvidence only records hintCount; Level 4 answer reveal is indistinguishable from a Level 1 cue",
  },
  {
    id: "MULTI_LEXEME_TASK",
    reason: "PublicLearningTask.lexemeId is singular",
  },
  {
    id: "CONTEXT_USE_SKILL",
    reason:
      "VocabularySkill.CONTEXT_USE remains frozen-unavailable; compiled tasks use MEANING_RECOGNITION or ACTIVE_RECALL",
  },
] as const;
