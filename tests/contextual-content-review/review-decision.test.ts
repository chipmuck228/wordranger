import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { currentContentFingerprint } from "@/server/contextual-content-review/project-review-packet";
import { CONTENT_REVIEW_TARGETS } from "@/server/contextual-content-review/review-target-registry";
import { saveContentReviewDecision } from "@/server/contextual-content-review/save-review-decision";
import { getApprovedExperimentSceneContent } from "@/contextual-learning/candidate-v0/content";
import { MEAL_SCENE_CONTENT_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-01";
import { registryStatusFor } from "@/contextual-learning/candidate-v0/content";

const spec = CONTENT_REVIEW_TARGETS[0]!;
const writeEnv = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
};

function tempRepository() {
  const dir = mkdtempSync(path.join(tmpdir(), "content-review-"));
  return new FileContentReviewRepository((reviewKey) =>
    path.join(dir, reviewKey, "human-review.record.json"),
  );
}

describe("Content review decisions", () => {
  it("starts PENDING and can save APPROVED without promoting the pack", async () => {
    const repository = tempRepository();
    const fingerprint = currentContentFingerprint(spec)!;
    expect(await repository.get(spec.reviewKey)).toBeNull();
    const saved = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "APPROVED",
      notes: [],
      env: writeEnv,
      repository,
      syncMarkdown: false,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }
    expect(saved.record.decision).toBe("APPROVED");
    expect(saved.record.revision).toBe(1);
    expect(saved.record.reviewer).toBe("LOCAL_INTERNAL_REVIEWER");
    expect(MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.status).toBe("CANDIDATE");
    expect(registryStatusFor(MEAL_SCENE_EXPANSION_BATCH_01_PACK.id)).toBe("CANDIDATE");
    const approved = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    expect(approved.ok && approved.pack.lexemes).toHaveLength(4);
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_01_PACK.id).ok).toBe(
      false,
    );
  });

  it("requires notes for revise and reject", async () => {
    const repository = tempRepository();
    const fingerprint = currentContentFingerprint(spec)!;
    const revise = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "REVISE",
      notes: [],
      env: writeEnv,
      repository,
      syncMarkdown: false,
    });
    const rejected = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "REJECTED",
      notes: [" "],
      env: writeEnv,
      repository,
      syncMarkdown: false,
    });
    expect(revise).toMatchObject({ ok: false, code: "CONTENT_REVIEW_NOTES_REQUIRED" });
    expect(rejected).toMatchObject({ ok: false, code: "CONTENT_REVIEW_NOTES_REQUIRED" });
  });

  it("rejects stale fingerprints and is idempotent for the same decision", async () => {
    const repository = tempRepository();
    const fingerprint = currentContentFingerprint(spec)!;
    const first = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "REVISE",
      notes: ["fix contrast copy"],
      env: writeEnv,
      repository,
      syncMarkdown: false,
    });
    const again = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "REVISE",
      notes: ["fix contrast copy"],
      env: writeEnv,
      repository,
      syncMarkdown: false,
    });
    const stale = await saveContentReviewDecision({
      fingerprint: "0".repeat(64),
      revision: 0,
      decision: "APPROVED",
      notes: [],
      env: writeEnv,
      repository,
      syncMarkdown: false,
    });
    expect(first.ok).toBe(true);
    expect(again.ok && again.idempotent).toBe(true);
    expect(stale).toMatchObject({ ok: false, code: "CONTENT_REVIEW_STALE" });
  });

  it("fail-closes concurrent different decisions on the public save path", async () => {
    const repository = tempRepository();
    const fingerprint = currentContentFingerprint(spec)!;
    const [left, right] = await Promise.all([
      saveContentReviewDecision({
        fingerprint,
        revision: 0,
        decision: "APPROVED",
        notes: [],
        env: writeEnv,
        repository,
        syncMarkdown: false,
      }),
      saveContentReviewDecision({
        fingerprint,
        revision: 0,
        decision: "REJECTED",
        notes: ["no"],
        env: writeEnv,
        repository,
        syncMarkdown: false,
      }),
    ]);
    const outcomes = [left, right];
    expect(outcomes.filter((item) => item.ok)).toHaveLength(1);
    expect(outcomes.some((item) => !item.ok && item.code === "CONTENT_REVIEW_CONFLICT")).toBe(
      true,
    );
    const stored = await repository.get(spec.reviewKey);
    expect(stored?.revision).toBe(1);
  });

  it("cannot write without the local write gate or on deployed hosts", async () => {
    const repository = tempRepository();
    const fingerprint = currentContentFingerprint(spec)!;
    const disabled = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "APPROVED",
      notes: [],
      env: {
        CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
        CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "0",
      },
      repository,
      syncMarkdown: false,
    });
    const production = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "APPROVED",
      notes: [],
      env: { ...writeEnv, VERCEL_ENV: "production" },
      repository,
      syncMarkdown: false,
    });
    const preview = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "APPROVED",
      notes: [],
      env: { ...writeEnv, VERCEL_ENV: "preview" },
      repository,
      syncMarkdown: false,
    });
    expect(disabled).toMatchObject({ ok: false, code: "CONTENT_REVIEW_WRITE_DISABLED" });
    expect(production).toMatchObject({ ok: false, code: "CONTENT_REVIEW_WRITE_DISABLED" });
    expect(preview).toMatchObject({ ok: false, code: "CONTENT_REVIEW_WRITE_DISABLED" });
  });
});
