/**
 * Candidate V0 / Experimental / Not a Standard.
 * Structured clones so transitions never mutate the input run.
 */

export function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
