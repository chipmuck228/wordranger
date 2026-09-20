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

export function deriveFrozenHintCountFromSupportExposure(input: {
  target: LexemeSenseRef;
  exposures: readonly ContextualSupportExposure[];
}): number {
  const shown = input.exposures.some(
    (item) =>
      sameLexemeSense(item.target, input.target) && FORM_SUPPORT.has(item.kind),
  );
  return shown ? 1 : 0;
}
