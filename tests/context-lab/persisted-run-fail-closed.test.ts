import { describe, expect, it } from "vitest";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import { BUNDLED_LEXEME_BINDINGS } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import type { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import { acknowledgeUntilFrozen } from "./helpers";
import {
  createNineWordLabHarness,
  installActiveRelease,
  labeledReleaseFromPublished,
  publishSyntheticNineWordRelease,
  SNAPSHOT_A_LABELS,
  SNAPSHOT_B_LABELS,
} from "./batch-03-release-helpers";
import type { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import type { ContextualContentReleaseManifest } from "@/contextual-learning/candidate-v0/release";

const SPOON_FORM =
  bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.spoon.canonicalKey)?.display ??
  "spoon";

function assertKind<K extends ContextLabCurrentScreen["kind"]>(
  screen: ContextLabCurrentScreen,
  kind: K,
): asserts screen is Extract<ContextLabCurrentScreen, { kind: K }> {
  if (screen.kind !== kind) {
    throw new Error(`expected ${kind}, got ${screen.kind}`);
  }
}

function assertContentUnavailable(screen: ContextLabCurrentScreen) {
  expect(screen.kind).toBe("ERROR");
  assertKind(screen, "ERROR");
  expect(screen.code).toContain(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE);
  const json = JSON.stringify(screen);
  expect(json).not.toContain(SNAPSHOT_A_LABELS.knife);
  expect(json).not.toContain(SNAPSHOT_B_LABELS.knife);
  expect(json).not.toContain(SNAPSHOT_B_LABELS.bread);
  expect(json).not.toContain('"label":"杯子"');
  expect(json).not.toContain('"label":"盘子"');
  expect(json).not.toContain("FROZEN_TASK_RECORDED");
  expect(json).not.toContain("PROBE_INTRO");
}

function corruptPinnedRelease(
  releases: InMemoryContextualContentReleaseRepository,
  release: ContextualContentReleaseManifest,
) {
  releases.replaceRaw({
    ...release,
    releaseFingerprint: "0".repeat(64),
  });
}

async function submitTyping(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
  value: string,
) {
  assertKind(screen, "FROZEN_TASK_PREVIEW");
  return controller.submitFrozenTask({
    runId: screen.handle.runId,
    revision: screen.handle.revision,
    taskId: screen.task.id,
    action: { kind: "TEXT_INPUT", value },
  });
}

async function completePinnedBuild() {
  const published = await publishSyntheticNineWordRelease();
  const releaseA = labeledReleaseFromPublished(published.published, {
    releaseId: "meal-snapshot-a-completed",
    labels: SNAPSHOT_A_LABELS,
    captions: {
      knife: "A版小刀关系说明",
      bread: "A版面包对比说明",
      water: "A版水关系说明",
    },
  });
  const releaseB = labeledReleaseFromPublished(published.published, {
    releaseId: "meal-snapshot-b-completed",
    labels: SNAPSHOT_B_LABELS,
    captions: {
      knife: "B版小刀关系说明",
      bread: "B版面包对比说明",
      water: "B版水关系说明",
    },
  });
  installActiveRelease(published.releases, releaseA);
  const harness = createNineWordLabHarness(published.releases, undefined, {
    beginAt: "BUILD",
  });
  const started = await harness.controller.start();
  if (started.kind === "ERROR") {
    throw new Error(`${started.code}: ${started.message}`);
  }
  const frozen = await acknowledgeUntilFrozen(harness.controller, started);
  const recorded = await submitTyping(harness.controller, frozen, SPOON_FORM);
  assertKind(recorded, "FROZEN_TASK_RECORDED");
  return {
    ...harness,
    published,
    releaseA,
    releaseB,
    recorded,
    taskId: frozen.task.id,
    runId: recorded.handle.runId,
  };
}

describe("Context Lab persisted-run content fail-closed", () => {
  it("does not show static or later-release copy when a completed run loses its pin", async () => {
    const completed = await completePinnedBuild();
    expect(completed.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);

    corruptPinnedRelease(completed.published.releases, completed.releaseA);
    installActiveRelease(completed.published.releases, completed.releaseB, 2);

    const loaded = await completed.controller.loadCurrent({ runId: completed.runId });
    assertContentUnavailable(loaded);
    expect(completed.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
  });

  it("duplicate frozen reconciliation fail-closes without extra Evidence", async () => {
    const completed = await completePinnedBuild();
    expect(completed.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);

    corruptPinnedRelease(completed.published.releases, completed.releaseA);
    installActiveRelease(completed.published.releases, completed.releaseB, 2);

    const duplicate = await completed.controller.submitFrozenTask({
      runId: completed.recorded.handle.runId,
      revision: completed.recorded.handle.revision,
      taskId: completed.taskId,
      action: { kind: "TEXT_INPUT", value: SPOON_FORM },
    });
    assertContentUnavailable(duplicate);
    expect(completed.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
  });

  it("duplicate Probe submission fail-closes after the pin is damaged", async () => {
    const published = await publishSyntheticNineWordRelease();
    const releaseA = labeledReleaseFromPublished(published.published, {
      releaseId: "meal-snapshot-a-probe-dup",
      labels: SNAPSHOT_A_LABELS,
      captions: {
        knife: "A版小刀关系说明",
        bread: "A版面包对比说明",
        water: "A版水关系说明",
      },
    });
    installActiveRelease(published.releases, releaseA);
    const { controller, learning } = createNineWordLabHarness(published.releases);
    const started = await controller.start();
    assertKind(started, "PROBE_INTRO");
    const issued = await controller.continueProbe({
      runId: started.handle.runId,
      revision: started.handle.revision,
    });
    assertKind(issued, "FROZEN_TASK_PREVIEW");
    const recorded = await submitTyping(controller, issued, "soup");
    assertKind(recorded, "PROBE_TASK_RECORDED");
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);

    corruptPinnedRelease(published.releases, releaseA);
    const duplicate = await controller.submitFrozenTask({
      runId: issued.handle.runId,
      revision: recorded.handle.revision,
      taskId: issued.task.id,
      action: { kind: "TEXT_INPUT", value: "soup" },
    });
    assertContentUnavailable(duplicate);
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
  });

  it("Probe CAS reconciliation fail-closes when the pinned release cannot be read", async () => {
    const published = await publishSyntheticNineWordRelease();
    const releaseA = labeledReleaseFromPublished(published.published, {
      releaseId: "meal-snapshot-a-probe-cas",
      labels: SNAPSHOT_A_LABELS,
      captions: {
        knife: "A版小刀关系说明",
        bread: "A版面包对比说明",
        water: "A版水关系说明",
      },
    });
    installActiveRelease(published.releases, releaseA);
    const { controller, learning, repository } = createNineWordLabHarness(
      published.releases,
    );
    const started = await controller.start();
    assertKind(started, "PROBE_INTRO");
    const issued = await controller.continueProbe({
      runId: started.handle.runId,
      revision: started.handle.revision,
    });
    assertKind(issued, "FROZEN_TASK_PREVIEW");
    const recorded = await submitTyping(controller, issued, "soup");
    assertKind(recorded, "PROBE_TASK_RECORDED");
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);

    const stored = await repository.get({
      runId: issued.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.probe).toBeTruthy();
    const reopened = await repository.saveIfRevision({
      runId: stored!.id,
      userId: V1_PLACEHOLDER_USER_ID,
      expectedRevision: stored!.revision,
      nextRun: stored!.experienceRun,
      nextProbe: {
        ...stored!.probe!,
        phase: "PROBE_TASK_ISSUED",
        issued: {
          taskId: issued.task.id,
          targetLexemeId: stored!.probe!.targets[0]!.target.lexemeId,
          senseId: stored!.probe!.targets[0]!.target.senseId,
          skill: "ACTIVE_RECALL",
          entityId: stored!.probe!.targets[0]!.entityId,
        },
      },
      updatedAt: "2026-09-22T08:01:00.000Z",
    });
    expect(reopened.ok).toBe(true);

    corruptPinnedRelease(published.releases, releaseA);
    const reconciled = await controller.submitFrozenTask({
      runId: issued.handle.runId,
      revision: reopened.ok ? reopened.revision : stored!.revision,
      taskId: issued.task.id,
      action: { kind: "TEXT_INPUT", value: "soup" },
    });
    assertContentUnavailable(reconciled);
    expect(learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
  });

  it("keeps completed-run recovery and duplicate submit idempotent while the pin is intact", async () => {
    const completed = await completePinnedBuild();
    const recovered = await completed.controller.loadCurrent({
      runId: completed.runId,
    });
    assertKind(recovered, "FROZEN_TASK_RECORDED");
    expect(JSON.stringify(recovered)).not.toContain(SNAPSHOT_B_LABELS.knife);

    const duplicate = await completed.controller.submitFrozenTask({
      runId: completed.recorded.handle.runId,
      revision: completed.recorded.handle.revision,
      taskId: completed.taskId,
      action: { kind: "TEXT_INPUT", value: SPOON_FORM },
    });
    assertKind(duplicate, "FROZEN_TASK_RECORDED");
    expect(completed.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
  });
});
