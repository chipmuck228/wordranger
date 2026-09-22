import { describe, expect, it } from "vitest";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import { loadContextLabContent } from "@/server/context-lab/context-lab-content-source";
import { InMemoryContextLabRunRepository } from "@/server/context-lab/in-memory-context-lab-run-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import { preflightContextualContentRelease } from "@/server/contextual-content-release/preflight-contextual-content-release";
import { publishContextualContentRelease } from "@/server/contextual-content-release/publish-contextual-content-release";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { collectKeys } from "./helpers";

const WRITE_ENV = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
  CONTEXTUAL_RELEASE_RUNTIME: "memory",
  CONTEXT_LAB_CONTENT_SOURCE: "active-release",
};

async function publishRelease(
  repository: InMemoryContextualContentReleaseRepository,
  now: string,
) {
  const created = await createMealMigrationDraft({
    env: WRITE_ENV,
    repository,
    reviewRepository: fileContentReviewRepository,
    now,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error(created.message);
  }
  const preflight = await preflightContextualContentRelease({
    env: WRITE_ENV,
    repository,
    releaseId: created.record.releaseId,
    revision: created.record.revision,
  });
  expect(preflight.ok).toBe(true);
  if (!preflight.ok) {
    throw new Error(preflight.message);
  }
  const published = await publishContextualContentRelease({
    env: WRITE_ENV,
    repository,
    releaseId: preflight.record.releaseId,
    revision: preflight.record.revision,
    now: `${now.slice(0, 19)}.002Z`,
  });
  expect(published.ok).toBe(true);
  if (!published.ok) {
    throw new Error(published.message);
  }
  return published;
}

function controller(
  releaseRepository: InMemoryContextualContentReleaseRepository,
  runs = new InMemoryContextLabRunRepository(),
) {
  return new MealContextLabController({
    repository: runs,
    learningTasks: new InMemoryLearningTaskRepository(),
    learning: new InMemoryLearningRepository(),
    userId: V1_PLACEHOLDER_USER_ID,
    beginAt: "PROBE",
    loadContent: (pin) =>
      loadContextLabContent({
        env: WRITE_ENV,
        repository: releaseRepository,
        pin,
      }),
  });
}

describe("Context Lab release pinning", () => {
  it("pins the active published release on a new run and keeps it after a later publish", async () => {
    const releases = new InMemoryContextualContentReleaseRepository();
    const runs = new InMemoryContextLabRunRepository();
    const first = await publishRelease(releases, "2026-09-22T01:00:00.000Z");
    const lab = controller(releases, runs);
    const started = await lab.start();
    expect(started.kind).toBe("PROBE_INTRO");
    if (started.kind !== "PROBE_INTRO") {
      throw new Error(started.kind);
    }
    expect(started.handle.contentReleaseId).toBe(first.record.releaseId);
    const stored = await runs.get({
      runId: started.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.releaseId).toBe(first.record.releaseId);
    expect(stored?.releaseFingerprint).toBe(first.record.releaseFingerprint);
    expect(stored?.experienceRun.releaseId).toBe(first.record.releaseId);

    const second = await publishRelease(releases, "2026-09-22T02:00:00.000Z");
    const continued = await lab.continueProbe({
      runId: started.handle.runId,
      revision: started.handle.revision,
    });
    expect(continued.kind).not.toBe("ERROR");
    const after = await runs.get({
      runId: started.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(after?.releaseId).toBe(first.record.releaseId);
    expect(after?.releaseFingerprint).toBe(first.record.releaseFingerprint);

    const nextRun = await controller(releases).start();
    expect(nextRun.kind).toBe("PROBE_INTRO");
    if (nextRun.kind !== "PROBE_INTRO") {
      throw new Error(nextRun.kind);
    }
    expect(nextRun.handle.contentReleaseId).toBe(second.record.releaseId);
  });

  it("does not leak review or approval internals in the browser payload", async () => {
    const releases = new InMemoryContextualContentReleaseRepository();
    await publishRelease(releases, "2026-09-22T01:00:00.000Z");
    const screen = await controller(releases).start();
    const keys = collectKeys(screen);
    expect(keys.has("humanDecision")).toBe(false);
    expect(keys.has("approvalBasis")).toBe(false);
    expect(keys.has("reviewKey")).toBe(false);
    expect(keys.has("answerKey")).toBe(false);
    expect(keys.has("validationSummary")).toBe(false);
    expect(JSON.stringify(screen)).not.toContain("HUMAN_REVIEW_PROMOTION");
  });

  it("fail-closes when active-release content is missing", async () => {
    const releases = new InMemoryContextualContentReleaseRepository();
    const screen = await controller(releases).start();
    expect(screen.kind).toBe("ERROR");
    if (screen.kind !== "ERROR") {
      throw new Error(screen.kind);
    }
    expect(screen.code).toContain(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE);
  });
});
