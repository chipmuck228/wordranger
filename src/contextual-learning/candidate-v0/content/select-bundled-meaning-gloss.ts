/**
 * Sense-aware meaning selection from bundled vocabulary.
 * Candidate cannot invent a gloss that is not in meaningsZh.
 */

import type { BundledMeaningGlossSelector } from "./types";

export function selectBundledMeaningGloss(input: {
  meaningsZh: readonly string[] | undefined;
  selector?: BundledMeaningGlossSelector;
}): string | null {
  const meanings = (input.meaningsZh ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (meanings.length === 0) {
    return null;
  }
  const selector = input.selector;
  if (!selector) {
    return meanings.length === 1 ? meanings[0]! : null;
  }
  if (selector.kind === "EXACT_BUNDLED_VALUE") {
    const value = selector.value.trim();
    if (!value) {
      return null;
    }
    return meanings.includes(value) ? value : null;
  }
  if (selector.kind === "BUNDLED_INDEX") {
    if (!Number.isInteger(selector.index) || selector.index < 0) {
      return null;
    }
    return meanings[selector.index] ?? null;
  }
  return null;
}
