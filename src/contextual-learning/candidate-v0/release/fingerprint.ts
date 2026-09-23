import { createHash } from "node:crypto";
import { fingerprintAuthoredPack } from "../content/content-fingerprint";
import type {
  ContextualContentReleaseManifest,
  ReleaseContextSnapshot,
  ReleaseSnapshot,
  ReleaseTargetEntry,
} from "./types";
import { sortedJson } from "./canonical-json";

function sha256(value: unknown): string {
  return createHash("sha256").update(sortedJson(value)).digest("hex");
}

export function fingerprintAuthoredPackSnapshot(
  pack: ReleaseSnapshot["pack"],
): string {
  return fingerprintAuthoredPack(pack);
}

export function fingerprintContextModel(context: ReleaseContextSnapshot): string {
  return sha256({
    runtimeContextId: context.runtimeContextId,
    frames: context.frames,
    skeleton: context.skeleton,
  });
}

export function releaseFingerprintPayload(input: {
  sceneId: string;
  baseReleaseId: string | null;
  targetEntries: readonly ReleaseTargetEntry[];
  snapshot: ReleaseSnapshot;
}): unknown {
  return {
    sceneId: input.sceneId,
    baseReleaseId: input.baseReleaseId,
    targetEntries: input.targetEntries.map((entry) => ({
      reviewKey: entry.reviewKey,
      packId: entry.packId,
      target: entry.target,
      contentFingerprint: entry.contentFingerprint,
      reviewRevision: entry.reviewRevision,
      humanDecision: entry.humanDecision,
      selectedMeaning: entry.selectedMeaning,
      sourceRefs: entry.sourceRefs,
      approvalBasis: entry.approvalBasis,
    })),
    pack: input.snapshot.pack,
    context: input.snapshot.context,
    packSourceRefs: input.snapshot.pack.provenance.sourceRefs,
  };
}

export function fingerprintReleaseSnapshot(input: {
  sceneId: string;
  baseReleaseId: string | null;
  targetEntries: readonly ReleaseTargetEntry[];
  snapshot: ReleaseSnapshot;
}): string {
  return sha256(releaseFingerprintPayload(input));
}

export function fingerprintsForManifest(manifest: ContextualContentReleaseManifest): {
  packFingerprint: string;
  contextModelFingerprint: string;
  releaseFingerprint: string;
} {
  const snapshot: ReleaseSnapshot = {
    pack: manifest.packSnapshot,
    context: manifest.contextSnapshot,
  };
  return {
    packFingerprint: fingerprintAuthoredPackSnapshot(snapshot.pack),
    contextModelFingerprint: fingerprintContextModel(snapshot.context),
    releaseFingerprint: fingerprintReleaseSnapshot({
      sceneId: manifest.sceneId,
      baseReleaseId: manifest.baseReleaseId,
      targetEntries: manifest.targetEntries,
      snapshot,
    }),
  };
}
