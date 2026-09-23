import "server-only";

import {
  experimentalMealContextLabPack,
} from "@/contextual-learning/candidate-v0/content/experimental-meal-runtime-pack";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import {
  experimentalMealRuntimeContextId,
  resolveMealRuntimeContext,
} from "@/contextual-learning/candidate-v0/planning/meal-runtime-context";
import {
  MEAL_RELEASE_SCENE_ID,
  fingerprintAuthoredPackSnapshot,
  fingerprintsForManifest,
  type ContextualContentReleaseManifest,
  type ReleaseContextSnapshot,
} from "@/contextual-learning/candidate-v0/release";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { createContextualReleaseRepository } from "@/server/contextual-content-release/create-release-runtime";
import type { ContextualContentReleaseRepository } from "@/server/contextual-content-release/release-repository";
import { ContextLabError } from "./context-lab-errors";

export type ContextLabContentSourceMode = "static" | "active-release";

export interface ContextLabContentSnapshot {
  source: ContextLabContentSourceMode;
  pack: ContextualSceneContentPack;
  context: ReleaseContextSnapshot;
  releaseId: string;
  releaseFingerprint: string;
}

export function resolveContextLabContentSourceMode(
  env: Record<string, string | undefined> = process.env,
): ContextLabContentSourceMode {
  const raw = env.CONTEXT_LAB_CONTENT_SOURCE?.trim();
  if (raw == null || raw === "") {
    return "static";
  }
  if (raw !== "static" && raw !== "active-release") {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_RUNTIME_INVALID,
      "CONTEXT_LAB_CONTENT_SOURCE must be static or active-release",
      false,
    );
  }
  return raw;
}

export async function loadContextLabContent(input: {
  env?: Record<string, string | undefined>;
  repository?: ContextualContentReleaseRepository;
  pin?: { releaseId: string; releaseFingerprint: string } | null;
} = {}): Promise<ContextLabContentSnapshot> {
  const env = input.env ?? process.env;
  const mode = resolveContextLabContentSourceMode(env);
  if (mode === "static") {
    return loadStaticContent();
  }
  const repository = input.repository ?? createContextualReleaseRepository(env);
  if (input.pin) {
    return loadPinnedPublishedRelease(repository, input.pin);
  }
  const loaded = await repository.loadActiveRelease(MEAL_RELEASE_SCENE_ID);
  if (!loaded.ok) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
      "Experimental Context Lab content is unavailable.",
      false,
    );
  }
  return snapshotFromRelease(loaded.release, "active-release");
}

function loadStaticContent(): ContextLabContentSnapshot {
  const pack = experimentalMealContextLabPack();
  const runtimeContextId = experimentalMealRuntimeContextId();
  const context = resolveMealRuntimeContext(runtimeContextId);
  return {
    source: "static",
    pack,
    context: {
      runtimeContextId: context.id,
      frames: context.frames,
      skeleton: context.skeleton,
    },
    releaseId: `static:${pack.id}`,
    releaseFingerprint: fingerprintAuthoredPackSnapshot(pack),
  };
}

async function loadPinnedPublishedRelease(
  repository: ContextualContentReleaseRepository,
  pin: { releaseId: string; releaseFingerprint: string },
): Promise<ContextLabContentSnapshot> {
  if (pin.releaseId.startsWith("static:")) {
    const staticContent = loadStaticContent();
    if (staticContent.releaseFingerprint !== pin.releaseFingerprint) {
      throw new ContextLabError(
        CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
        "Experimental Context Lab content is unavailable.",
        false,
      );
    }
    return staticContent;
  }
  const release = await repository.get(pin.releaseId);
  if (
    !release ||
    release.publishedAt == null ||
    (release.status !== "PUBLISHED" && release.status !== "SUPERSEDED")
  ) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
      "Experimental Context Lab content is unavailable.",
      false,
    );
  }
  if (release.releaseFingerprint !== pin.releaseFingerprint) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
      "Experimental Context Lab content is unavailable.",
      false,
    );
  }
  const computed = fingerprintsForManifest(release);
  if (computed.releaseFingerprint !== release.releaseFingerprint) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
      "Experimental Context Lab content is unavailable.",
      false,
    );
  }
  return snapshotFromRelease(release, "active-release");
}

function snapshotFromRelease(
  release: ContextualContentReleaseManifest,
  source: ContextLabContentSourceMode,
): ContextLabContentSnapshot {
  return {
    source,
    pack: release.packSnapshot,
    context: release.contextSnapshot,
    releaseId: release.releaseId,
    releaseFingerprint: release.releaseFingerprint,
  };
}
