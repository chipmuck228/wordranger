/**
 * Candidate V0 learner-facing lexical projection.
 * Experimental / Not a Standard.
 *
 * Bundled vocabulary stores some source notes inside lemma/display
 * (for example knife(pl.knives)). Frozen /train still uses the raw lemma.
 * Context Lab presentation and Candidate compilation must not treat that
 * annotation as the typing answer or spelling cue.
 *
 * This is the only place that interprets those notes. Callers must not
 * strip parentheses ad hoc.
 */

export type LearnerLexicalFormSource = "PLAIN_LEMMA" | "IRREGULAR_PLURAL_NOTE";

export type LearnerLexicalForm =
  | {
      ok: true;
      answerForm: string;
      displayForm: string;
      inflectionNote: string | null;
      source: LearnerLexicalFormSource;
    }
  | { ok: false; reason: "LEXICAL_FORM_UNPROJECTABLE" };

const PLAIN_LEMMA = /^[A-Za-z]+$/;
const IRREGULAR_PLURAL =
  /^([A-Za-z]+)\s*\(\s*pl\.?\s*([A-Za-z]+|-es)\s*\)$/i;

export function projectLearnerLexicalForm(input: {
  lemma?: string | null;
  display?: string | null;
}): LearnerLexicalForm {
  const raw = input.display?.trim() || input.lemma?.trim() || "";
  if (!raw) {
    return { ok: false, reason: "LEXICAL_FORM_UNPROJECTABLE" };
  }
  if (PLAIN_LEMMA.test(raw)) {
    const answerForm = raw.toLowerCase();
    return {
      ok: true,
      answerForm,
      displayForm: answerForm,
      inflectionNote: null,
      source: "PLAIN_LEMMA",
    };
  }
  const plural = raw.match(IRREGULAR_PLURAL);
  const answerForm = plural?.[1]?.toLowerCase() ?? "";
  const pluralForm = plural?.[2]?.toLowerCase() ?? "";
  if (!plural || !PLAIN_LEMMA.test(answerForm) || !pluralForm) {
    return { ok: false, reason: "LEXICAL_FORM_UNPROJECTABLE" };
  }
  return {
    ok: true,
    answerForm,
    displayForm: answerForm,
    inflectionNote: `复数 ${pluralForm}`,
    source: "IRREGULAR_PLURAL_NOTE",
  };
}

export function requireLearnerLexicalForm(input: {
  lemma?: string | null;
  display?: string | null;
}): Extract<LearnerLexicalForm, { ok: true }> | null {
  const projected = projectLearnerLexicalForm(input);
  return projected.ok ? projected : null;
}
