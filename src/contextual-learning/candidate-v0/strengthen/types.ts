/**
 * Contextual Strengthen Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Support exposure is orchestration, not Evidence.
 */

import type { LexemeSenseRef } from "../domain/types";

export type ContextualSupportKind =
  | "MEANING_GLOSS"
  | "LEXICAL_FORM"
  | "SPELLING_CUE";

export interface ContextualSupportExposure {
  supportId: string;
  kind: ContextualSupportKind;
  target: LexemeSenseRef;
  shownAt: string;
  sourceStepId: string;
  planId: string;
}

export interface ContextualStrengthenQueueItem {
  target: LexemeSenseRef;
  entityId: string;
  sourceProbeTaskIds: readonly string[];
}

export interface MealLexicalStrengthenProfile {
  target: LexemeSenseRef;
  fixtureLexemeId: string;
  fixtureSense: LexemeSenseRef;
  sceneClusterId: string;
  entityId: string;
  roleId: string;
  canonicalKey: string;
  stepToken: string;
  displayForm: string;
  meaningGloss: string;
  displayLabel: string;
  phonetic?: string;
}

export const MEAL_STRENGTHEN_ORCHESTRATION_VERSION = "strengthen-queue-v1" as const;
