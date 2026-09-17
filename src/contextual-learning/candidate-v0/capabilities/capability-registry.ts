/**
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Transport capability answers: can the frozen runtime carry this response?
 * It does not answer: can frozen Evidence honestly record this cognition?
 *
 * Frozen runtime facts used here:
 * - PublicLearningTask.responseContract is CHOICE | TEXT_INPUT only
 * - the frozen evaluator grades optionId or normalized typed text
 * - PublicTaskHint exists as { id, text }; the frozen generator currently emits []
 * - hintCount > 0 becomes ASSISTED_CORRECT; there is no Level 0–4 evidence field
 * - one PublicLearningTask carries one lexemeId
 * - CONTEXT_USE and LISTENING_RECOGNITION stay unavailable as skills
 */

import type {
  ExpectedSemanticResponseKind,
  RuntimeCapability,
  SemanticAction,
} from "../domain/types";

export const CHOICE_COMPILER_ID = "candidate-v0-choice-adapter";
export const LEXICAL_FORM_COMPILER_ID = "candidate-v0-lexical-form-adapter";

export interface ResponseTransportCapability {
  id: string;
  responseContract: "CHOICE" | "TEXT_INPUT";
  supportedResponseKinds: ExpectedSemanticResponseKind[];
  maxOptions?: number;
  supportsHints: boolean;
}

const CHOICE_RESPONSE_KINDS: readonly ExpectedSemanticResponseKind[] = [
  "ENTITY_REF",
  "RELATION_CHOICE",
  "SEMANTIC_CLASS",
  "CLAIM_CHOICE",
];

export const CHOICE_TRANSPORT: ResponseTransportCapability = {
  id: "frozen-choice-transport",
  responseContract: "CHOICE",
  supportedResponseKinds: [...CHOICE_RESPONSE_KINDS],
  maxOptions: 6,
  supportsHints: true,
};

export const TEXT_INPUT_TRANSPORT: ResponseTransportCapability = {
  id: "frozen-text-input-transport",
  responseContract: "TEXT_INPUT",
  supportedResponseKinds: ["LEXICAL_FORM"],
  supportsHints: true,
};

export const RESPONSE_TRANSPORTS: readonly ResponseTransportCapability[] = [
  CHOICE_TRANSPORT,
  TEXT_INPUT_TRANSPORT,
];

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

function planningChoiceCapability(action: SemanticAction): RuntimeCapability {
  return {
    id: `frozen-choice:${action}`,
    supportsAction: action,
    responseKinds: [...CHOICE_RESPONSE_KINDS],
    maxOptions: 6,
    supportsContextSnapshot: false,
    supportsHintReveal: true,
    compilerId: CHOICE_COMPILER_ID,
  };
}

function planningTypingCapability(action: SemanticAction): RuntimeCapability {
  return {
    id: `frozen-text-input:${action}`,
    supportsAction: action,
    responseKinds: ["LEXICAL_FORM"],
    supportsContextSnapshot: false,
    supportsHintReveal: true,
    compilerId: LEXICAL_FORM_COMPILER_ID,
  };
}

/**
 * Planning-time transport inventory. Matching one of these IDs means the
 * frozen runtime can carry the answer form. It is not a semantic projection.
 */
export const FROZEN_RUNTIME_CAPABILITIES: readonly RuntimeCapability[] = [
  ...CHOICE_ACTIONS.map(planningChoiceCapability),
  ...TYPE_ACTIONS.map(planningTypingCapability),
];

export function listFrozenRuntimeCapabilities(): readonly RuntimeCapability[] {
  return FROZEN_RUNTIME_CAPABILITIES;
}

export function findResponseTransport(
  responseKind: ExpectedSemanticResponseKind,
): ResponseTransportCapability | undefined {
  return RESPONSE_TRANSPORTS.find((transport) =>
    transport.supportedResponseKinds.includes(responseKind),
  );
}

/**
 * Transport lookup only. Not sufficient to decide compilation.
 * Use findResponseTransport + findSemanticProjection instead.
 */
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
      "VocabularySkill.CONTEXT_USE remains frozen-unavailable; Candidate does not fake CONTEXT_USE Evidence",
  },
  {
    id: "GENERIC_CHOICE_MEANING_RECOGNITION",
    reason:
      "A CHOICE transport does not make claim, relation, class, or situational entity selection into MEANING_RECOGNITION",
  },
] as const;
