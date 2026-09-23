import { isContextLabEnabled } from "@/server/context-lab/is-context-lab-enabled";
import { resolveContextLabContentSourceMode } from "@/server/context-lab/context-lab-content-source";

export const CONTEXT_LAB_HREF = "/play/context-lab" as const;
export const DAILY_TRAINING_HREF = "/train" as const;

export type SceneLearningAvailability =
  | { status: "ready"; href: typeof CONTEXT_LAB_HREF }
  | { status: "preparing" };

export interface HomeLearningPaths {
  primaryHref: typeof DAILY_TRAINING_HREF;
  scene: SceneLearningAvailability;
}

/**
 * Homepage-only projection. It does not load releases, reviews,
 * promotions, or run state.
 *
 * Active-release availability cannot be confirmed without reading the
 * pointer. Homepage therefore fail-closes that mode instead of guessing
 * or falling back to static.
 */
export function resolveHomeLearningPaths(
  env: Record<string, string | undefined> = process.env,
): HomeLearningPaths {
  return {
    primaryHref: DAILY_TRAINING_HREF,
    scene: resolveSceneLearningAvailability(env),
  };
}

export function resolveSceneLearningAvailability(
  env: Record<string, string | undefined> = process.env,
): SceneLearningAvailability {
  if (!isContextLabEnabled(env)) {
    return { status: "preparing" };
  }

  try {
    const mode = resolveContextLabContentSourceMode(env);
    if (mode === "static") {
      return { status: "ready", href: CONTEXT_LAB_HREF };
    }
    return { status: "preparing" };
  } catch {
    return { status: "preparing" };
  }
}
