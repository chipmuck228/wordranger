import { describe, expect, it } from "vitest";
import { MEAL_SCENE_EXPANSION_BATCH_02_PACK } from "@/contextual-learning/candidate-v0/content";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  fingerprintContextModel,
  fingerprintReleaseSnapshot,
  fingerprintsForManifest,
  parseReleaseManifest,
  validateDraftRelease,
  validateReleaseTransition,
} from "@/contextual-learning/candidate-v0/release";
import { buildMealMigrationAuthority, manifestFromAuthority } from "@/server/contextual-content-release/authority";

async function draftManifest() {
  const authority = await buildMealMigrationAuthority();
  expect(authority.targetEntries).toHaveLength(6);
  return manifestFromAuthority({
    authority,
    createdAt: "2026-09-22T00:00:00.000Z",
  });
}

describe("release domain fingerprints and transitions", () => {
  it("computes a deterministic release fingerprint", async () => {
    const manifest = await draftManifest();
    const first = fingerprintsForManifest(manifest);
    const second = fingerprintsForManifest(structuredClone(manifest));
    expect(first.releaseFingerprint).toBe(second.releaseFingerprint);
    expect(first.releaseFingerprint).toBe(manifest.releaseFingerprint);
    expect(validateDraftRelease(manifest)).toEqual({ ok: true, issues: [] });
  });

  it("changes fingerprint when target order changes", async () => {
    const manifest = await draftManifest();
    const reordered = cloneFrozen({
      ...manifest,
      targetEntries: [...manifest.targetEntries].reverse(),
    });
    const next = fingerprintReleaseSnapshot({
      sceneId: reordered.sceneId,
      baseReleaseId: reordered.baseReleaseId,
      targetEntries: reordered.targetEntries,
      snapshot: { pack: reordered.packSnapshot, context: reordered.contextSnapshot },
    });
    expect(next).not.toBe(manifest.releaseFingerprint);
    expect(validateDraftRelease(reordered).ok).toBe(false);
    expect(validateDraftRelease(reordered).issues.some((item) => item.code === "RELEASE_TARGET_ORDER")).toBe(true);
  });

  it("changes fingerprint when pack content changes", async () => {
    const manifest = await draftManifest();
    const pack = structuredClone(manifest.packSnapshot);
    pack.lexemes[0]!.build.teachInstruction = `${pack.lexemes[0]!.build.teachInstruction} changed`;
    const next = fingerprintReleaseSnapshot({
      sceneId: manifest.sceneId,
      baseReleaseId: manifest.baseReleaseId,
      targetEntries: manifest.targetEntries,
      snapshot: { pack, context: manifest.contextSnapshot },
    });
    expect(next).not.toBe(manifest.releaseFingerprint);
  });

  it("changes context fingerprint when frames or skeleton change", async () => {
    const manifest = await draftManifest();
    const framesChanged = structuredClone(manifest.contextSnapshot);
    framesChanged.frames = framesChanged.frames.map((frame, index) =>
      index === 0 ? { ...frame, title: `${frame.title} x` } : frame,
    );
    expect(fingerprintContextModel(framesChanged)).not.toBe(manifest.contextModelFingerprint);
    const skeletonChanged = structuredClone(manifest.contextSnapshot);
    skeletonChanged.skeleton = {
      ...skeletonChanged.skeleton,
      id: `${skeletonChanged.skeleton.id}-x`,
    };
    expect(fingerprintContextModel(skeletonChanged)).not.toBe(manifest.contextModelFingerprint);
  });

  it("rejects duplicate targets and senses", async () => {
    const manifest = await draftManifest();
    const duplicated = cloneFrozen({
      ...manifest,
      targetEntries: [...manifest.targetEntries, manifest.targetEntries[0]!],
    });
    const result = validateDraftRelease(duplicated);
    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.code === "RELEASE_DUPLICATE_TARGET")).toBe(true);
    expect(result.issues.some((item) => item.code === "RELEASE_DUPLICATE_SENSE")).toBe(true);
  });

  it("allows DRAFT → PREFLIGHT_VALIDATED and rejects DRAFT → PUBLISHED", async () => {
    const draft = await draftManifest();
    const validated = cloneFrozen({
      ...draft,
      status: "PREFLIGHT_VALIDATED" as const,
      validatedAt: "2026-09-22T00:00:01.000Z",
      validationSummary: { ok: true, issues: [] },
    });
    expect(validateReleaseTransition({ current: draft, next: validated }).ok).toBe(true);
    const published = cloneFrozen({
      ...draft,
      status: "PUBLISHED" as const,
    });
    const illegal = validateReleaseTransition({
      current: draft,
      next: published,
      requestedStatus: "PUBLISHED",
    });
    expect(illegal.ok).toBe(false);
    expect(illegal.issues.some((item) => item.code === "RELEASE_TRANSITION_ILLEGAL")).toBe(true);
    const fromValidated = cloneFrozen({
      ...validated,
      status: "PUBLISHED" as const,
      publishedAt: "2026-09-22T00:00:02.000Z",
      publishedBy: "LOCAL_INTERNAL_RELEASER",
    });
    expect(validateReleaseTransition({ current: validated, next: fromValidated }).ok).toBe(true);
  });

  it("treats a PREFLIGHT_VALIDATED manifest as immutable", async () => {
    const draft = await draftManifest();
    const validated = cloneFrozen({
      ...draft,
      status: "PREFLIGHT_VALIDATED" as const,
      validatedAt: "2026-09-22T00:00:01.000Z",
      validationSummary: { ok: true, issues: [] },
    });
    const mutated = cloneFrozen({
      ...validated,
      targetEntries: validated.targetEntries.map((entry, index) =>
        index === 0 ? { ...entry, contentFingerprint: "0".repeat(64) } : entry,
      ),
    });
    const result = validateReleaseTransition({ current: validated, next: mutated });
    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.code === "RELEASE_IMMUTABLE_MUTATION")).toBe(true);
    expect(parseReleaseManifest(validated)?.status).toBe("PREFLIGHT_VALIDATED");
    expect(MEAL_SCENE_EXPANSION_BATCH_02_PACK.id).toBe("meal-scene-expansion-batch-02");
  });
});
