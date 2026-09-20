/**
 * Deterministic spelling cue from a verified display form.
 * Candidate V0 / Experimental / Not a Standard.
 */

export function spellingCueFromDisplayForm(displayForm: string): string | null {
  const letters = [...displayForm.trim().toLowerCase()].filter((character) =>
    /[a-z]/.test(character),
  );
  if (letters.length === 0) {
    return null;
  }
  return letters
    .map((character, index) => (index === 0 ? character : "_"))
    .join(" ");
}
