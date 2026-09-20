/**
 * Maps persisted Candidate support exposure onto frozen StudentAction.hintCount.
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Frozen ASSISTED_CORRECT means this verification happened after support
 * exposure. It is not a new Candidate Evidence outcome.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type { ContextualSupportExposure } from "./types";

const FORM_SUPPORT = new Set(["LEXICAL_FORM", "SPELLING_CUE"]);
const KNOWN_KINDS = new Set(["MEANING_GLOSS", "LEXICAL_FORM", "SPELLING_CUE"]);

export function deriveFrozenHintCountFromSupportExposure(input: {
  target: LexemeSenseRef;
  planId: string;
  verificationStepId: string;
  stepIds: readonly string[];
  exposures: readonly ContextualSupportExposure[];
}):
  | { ok: true; hintCount: 1 }
  | { ok: false; reason: "STRENGTHEN_SUPPORT_SCOPE_AMBIGUOUS" } {
  if (!input.planId.trim() || !input.verificationStepId.trim() || input.stepIds.length === 0) {
    return { ok: false, reason: "STRENGTHEN_SUPPORT_SCOPE_AMBIGUOUS" };
  }
  const verificationIndex = input.stepIds.indexOf(input.verificationStepId);
  if (verificationIndex <= 0) {
    return { ok: false, reason: "STRENGTHEN_SUPPORT_SCOPE_AMBIGUOUS" };
  }

  let hasFormSupport = false;
  for (const item of input.exposures) {
    if (!sameLexemeSense(item.target, input.target) || item.planId !== input.planId) {
      continue;
    }
    if (isMalformedExposure(item)) {
      return { ok: false, reason: "STRENGTHEN_SUPPORT_SCOPE_AMBIGUOUS" };
    }
    const sourceIndex = input.stepIds.indexOf(item.sourceStepId);
    if (sourceIndex === -1 || sourceIndex >= verificationIndex) {
      return { ok: false, reason: "STRENGTHEN_SUPPORT_SCOPE_AMBIGUOUS" };
    }
    if (FORM_SUPPORT.has(item.kind)) {
      hasFormSupport = true;
    }
  }
  if (!hasFormSupport) {
    return { ok: false, reason: "STRENGTHEN_SUPPORT_SCOPE_AMBIGUOUS" };
  }
  return { ok: true, hintCount: 1 };
}

function isMalformedExposure(item: ContextualSupportExposure): boolean {
  return (
    !item.supportId?.trim() ||
    !item.planId?.trim() ||
    !item.sourceStepId?.trim() ||
    !item.shownAt?.trim() ||
    !item.target.lexemeId.trim() ||
    !item.target.senseId.trim() ||
    !KNOWN_KINDS.has(item.kind)
  );
}
