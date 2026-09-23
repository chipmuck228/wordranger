export const CONTEXT_LAB_HREF = "/play/context-lab" as const;
export const DAILY_TRAINING_HREF = "/train" as const;

export interface HomeLearningPaths {
  primaryHref: typeof DAILY_TRAINING_HREF;
}

/**
 * Homepage-only projection. Scene learning stays preparing. This file
 * does not read Context Lab flags, releases, or runtime.
 */
export function resolveHomeLearningPaths(): HomeLearningPaths {
  return {
    primaryHref: DAILY_TRAINING_HREF,
  };
}
