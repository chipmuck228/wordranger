/**
 * Deterministic spelling cue from a verified answer form.
 * Candidate V0 / Experimental / Not a Standard.
 *
 * The input must already be the typing answer, not an annotation-bearing
 * display string. This function does not strip parentheses or notes.
 */

const ANSWER_FORM = /^[A-Za-z]+$/;

export function spellingCueFromAnswerForm(answerForm: string): string | null {
  const form = answerForm.trim().toLowerCase();
  if (!ANSWER_FORM.test(form)) {
    return null;
  }
  return [...form]
    .map((character, index) => (index === 0 ? character : "_"))
    .join(" ");
}
