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
}
