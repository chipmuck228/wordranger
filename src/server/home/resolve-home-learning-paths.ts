import { isContextLabEnabled } from "@/server/context-lab/is-context-lab-enabled";
import { resolveContextLabContentSourceMode } from "@/server/context-lab/context-lab-content-source";
import { resolveContextLabRuntimeMode } from "@/server/context-lab/context-lab-runtime-mode";

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
 * Ready is only the combination Homepage can confirm without guessing:
 * enabled + static content + a locally legal memory runtime. Other
 * combinations, including supabase and active-release, stay preparing.
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
    const source = resolveContextLabContentSourceMode(env);
    const runtime = resolveContextLabRuntimeMode(env);
    if (source === "static" && runtime === "memory") {
      return { status: "ready", href: CONTEXT_LAB_HREF };
    }
    return { status: "preparing" };
  } catch {
    return { status: "preparing" };
  }
}
