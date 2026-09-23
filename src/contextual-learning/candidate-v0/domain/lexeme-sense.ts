/**
 * Candidate V0 / Experimental / Not a Standard.
 * Sense identity is always lexemeId + senseId.
 */

import type { LexemeSenseRef, SenseSemanticProfile } from "./types";

export function sameLexemeSense(
  left: LexemeSenseRef,
  right: LexemeSenseRef,
): boolean {
  return left.lexemeId === right.lexemeId && left.senseId === right.senseId;
}

export function lexemeSenseKey(sense: LexemeSenseRef): string {
  return `${sense.lexemeId}::${sense.senseId}`;
}

export function findByLexemeSense<T extends { sense: LexemeSenseRef }>(
  items: readonly T[],
  sense: LexemeSenseRef,
): T | undefined {
  return items.find((item) => sameLexemeSense(item.sense, sense));
}

export function findProfile(
  profiles: ReadonlyMap<string, SenseSemanticProfile>,
  sense: LexemeSenseRef,
): SenseSemanticProfile | undefined {
  return profiles.get(lexemeSenseKey(sense));
}
