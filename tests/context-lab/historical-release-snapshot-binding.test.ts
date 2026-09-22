import { describe, expect, it } from "vitest";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import {
  MEAL_SCENE_EXPANSION_BATCH_03_BREAD_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_03_WATER_TARGET,
} from "@/contextual-learning/candidate-v0/content";
import { fingerprintsForManifest } from "@/contextual-learning/candidate-v0/release";
import { BUNDLED_LEXEME_BINDINGS } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import type { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { collectKeys, FORBIDDEN_CLIENT_FIELDS } from "./helpers";
import {
  createNineWordLabHarness,
  installActiveRelease,
  labeledReleaseFromPublished,
  publishSyntheticNineWordRelease,
  SNAPSHOT_A_CAPTIONS,
  SNAPSHOT_A_LABELS,
  SNAPSHOT_B_CAPTIONS,
  SNAPSHOT_B_LABELS,
} from "./batch-03-release-helpers";

function assertKind<K extends ContextLabCurrentScreen["kind"]>(
  screen: ContextLabCurrentScreen,
  kind: K,
): asserts screen is Extract<ContextLabCurrentScreen, { kind: K }> {
  if (screen.kind !== kind) {
    throw new Error(`expected ${kind}, got ${screen.kind}`);
  }
}

const READY_BEFORE_KNIFE = ["soup", "bowl", "spoon", "fork", "cup", "plate"] as const;
const KNIFE_FORM = "knife";
const BREAD_FORM =
  bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.bread.canonicalKey)?.display ?? "bread";
const WATER_FORM =
  bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.water.canonicalKey)?.display ?? "water";

async function continueFrom(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
) {
  if (screen.kind === "ERROR") {
    throw new Error(`${screen.code}: ${screen.message}`);
  }
  return controller.continueProbe({
    runId: screen.handle.runId,
    revision: screen.handle.revision,
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

async function walkReady(
  controller: MealContextLabController,
  screen: ContextLabCurrentScreen,
  lemmas: readonly string[],
) {
  let current = screen;
  for (const lemma of lemmas) {
    if (current.kind !== "FROZEN_TASK_PREVIEW") {
      current = await continueFrom(controller, current);
    }
    current = await submitTyping(controller, current, lemma);
    current = await continueFrom(controller, current);
  }
  return current;
}

describe("Context Lab historical release snapshot binding", () => {
  it("keeps an old run on release A after the pointer moves to B", async () => {
    const published = await publishSyntheticNineWordRelease();
    const releaseA = labeledReleaseFromPublished(published.published, {
      releaseId: "meal-snapshot-a",
      labels: SNAPSHOT_A_LABELS,
      captions: SNAPSHOT_A_CAPTIONS,
    });
    const releaseB = labeledReleaseFromPublished(published.published, {
      releaseId: "meal-snapshot-b",
      labels: SNAPSHOT_B_LABELS,
      captions: SNAPSHOT_B_CAPTIONS,
    });
    expect(releaseA.releaseFingerprint).not.toBe(releaseB.releaseFingerprint);
    installActiveRelease(published.releases, releaseA);

    const { controller, repository, learningTasks } = createNineWordLabHarness(
      published.releases,
    );
    const started = await controller.start();
    assertKind(started, "PROBE_INTRO");
    expect(started.handle.contentReleaseId).toBe(releaseA.releaseId);
    expect(started.progress.total).toBe(9);
    const introJson = JSON.stringify(started);
    expect(introJson).toContain(SNAPSHOT_A_LABELS.knife);
    expect(introJson).toContain(SNAPSHOT_A_LABELS.bread);
    expect(introJson).toContain(SNAPSHOT_A_LABELS.water);
    expect(introJson).not.toContain(SNAPSHOT_B_LABELS.knife);
    expect(introJson).not.toContain(SNAPSHOT_B_LABELS.bread);
    expect(introJson).not.toContain(SNAPSHOT_B_LABELS.water);
    expect(introJson).not.toContain('"label":"小刀"');
    expect(introJson).not.toContain('"label":"面包"');

    const stored = await repository.get({
      runId: started.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.releaseId).toBe(releaseA.releaseId);
    expect(stored?.releaseFingerprint).toBe(releaseA.releaseFingerprint);
    expect(stored?.probe?.targets).toHaveLength(9);
    expect(
      stored?.probe?.targets.map((item) => item.target),
    ).toEqual(
      expect.arrayContaining([
        MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET,
        MEAL_SCENE_EXPANSION_BATCH_03_BREAD_TARGET,
        MEAL_SCENE_EXPANSION_BATCH_03_WATER_TARGET,
      ]),
    );
    expect(stored?.probe?.targets.map((item) => item.displayLabel)).toEqual(
      expect.arrayContaining([
        SNAPSHOT_A_LABELS.knife,
        SNAPSHOT_A_LABELS.bread,
        SNAPSHOT_A_LABELS.water,
      ]),
    );

    published.releases.replaceRaw({
      ...releaseA,
      status: "SUPERSEDED",
      supersededAt: "2026-09-22T09:00:00.000Z",
      supersededByReleaseId: releaseB.releaseId,
    });
    installActiveRelease(published.releases, releaseB, 2);

    const continued = await continueFrom(controller, started);
    expect(continued.kind).not.toBe("ERROR");
    const continuedJson = JSON.stringify(continued);
    expect(continuedJson).toContain(SNAPSHOT_A_LABELS.knife);
    expect(continuedJson).toContain(SNAPSHOT_A_LABELS.bread);
    expect(continuedJson).toContain(SNAPSHOT_A_LABELS.water);
    expect(continuedJson).not.toContain(SNAPSHOT_B_LABELS.knife);
    expect(continuedJson).not.toContain(SNAPSHOT_B_LABELS.bread);
    expect(continuedJson).not.toContain('"label":"小刀"');

    let screen = continued;
    screen = await walkReady(controller, screen, READY_BEFORE_KNIFE);
    if (screen.kind !== "FROZEN_TASK_PREVIEW") {
      screen = await continueFrom(controller, screen);
    }
    screen = await submitTyping(controller, screen, "nope");
    screen = await continueFrom(controller, screen);
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    const recognition = await learningTasks.getTaskForEvaluation(screen.task.id);
    const recognitionTexts =
      recognition?.task.publicTask.responseContract.kind === "CHOICE"
        ? recognition.task.publicTask.responseContract.options.map((item) => item.content.text)
        : [];
    expect(recognitionTexts).not.toContain(SNAPSHOT_B_LABELS.knife);
    expect(recognitionTexts).not.toContain(SNAPSHOT_B_LABELS.bread);
    const wrongOption =
      recognition?.task.publicTask.responseContract.kind === "CHOICE"
        ? recognition.task.publicTask.responseContract.options.find(
            (option) => !recognition.task.answerKey.correctOptionIds.includes(option.id),
          )?.id
        : "";
    screen = await controller.submitFrozenTask({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      taskId: screen.task.id,
      action: { kind: "CHOICE", optionId: wrongOption ?? "" },
    });
    screen = await continueFrom(controller, screen);
    screen = await walkReady(controller, screen, [BREAD_FORM, WATER_FORM]);
    if (screen.kind !== "PROBE_SUMMARY") {
      screen = await continueFrom(controller, screen);
    }
    assertKind(screen, "PROBE_SUMMARY");
    expect(JSON.stringify(screen)).toContain(SNAPSHOT_A_LABELS.knife);
    expect(JSON.stringify(screen)).not.toContain(SNAPSHOT_B_LABELS.knife);

    screen = await controller.continueProbe({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      intent: "START_BUILD",
    });
    if (screen.kind === "ERROR") {
      throw new Error(`${screen.code}: ${screen.message}`);
    }
    while (screen.kind === "GUIDED") {
      const guidedJson = JSON.stringify(screen);
      expect(guidedJson).toContain(SNAPSHOT_A_LABELS.knife);
      expect(guidedJson).not.toContain(SNAPSHOT_B_LABELS.knife);
      expect(guidedJson).not.toContain(SNAPSHOT_B_CAPTIONS.knife);
      if (screen.context.relationCaption) {
        expect(Object.values(SNAPSHOT_B_CAPTIONS)).not.toContain(screen.context.relationCaption);
      }
      if (screen.context.contrastCaptions?.length) {
        for (const item of screen.context.contrastCaptions) {
          expect(Object.values(SNAPSHOT_B_CAPTIONS)).not.toContain(item.caption);
        }
      }
      screen = await controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      });
    }
    assertKind(screen, "FROZEN_TASK_PREVIEW");
    expect(screen.task.lexemeId).toBe(MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET.lexemeId);
    expect(JSON.stringify(screen.context)).toContain(SNAPSHOT_A_LABELS.knife);
    expect(JSON.stringify(screen.context)).not.toContain(SNAPSHOT_B_LABELS.knife);
    const recorded = await submitTyping(controller, screen, KNIFE_FORM);
    assertKind(recorded, "FROZEN_TASK_RECORDED");

    const after = await repository.get({
      runId: started.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(after?.releaseId).toBe(releaseA.releaseId);
    expect(after?.releaseFingerprint).toBe(releaseA.releaseFingerprint);

    const nextRun = await createNineWordLabHarness(published.releases).controller.start();
    assertKind(nextRun, "PROBE_INTRO");
    expect(nextRun.handle.contentReleaseId).toBe(releaseB.releaseId);
    const nextJson = JSON.stringify(nextRun);
    expect(nextJson).toContain(SNAPSHOT_B_LABELS.knife);
    expect(nextJson).toContain(SNAPSHOT_B_LABELS.bread);
    expect(nextJson).not.toContain(SNAPSHOT_A_LABELS.knife);
    expect(nextJson).not.toContain('"label":"小刀"');

    const keys = collectKeys(started);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
    expect(keys.has("humanDecision")).toBe(false);
    expect(keys.has("approvalBasis")).toBe(false);
    expect(keys.has("reviewKey")).toBe(false);
    expect(keys.has("packSnapshot")).toBe(false);
    expect(keys.has("answerKey")).toBe(false);
    expect(JSON.stringify(started)).not.toContain("HUMAN_REVIEW_PROMOTION");
  });

  it("fail-closes when the pinned fingerprint is damaged and does not fall back to B", async () => {
    const published = await publishSyntheticNineWordRelease();
    const releaseA = labeledReleaseFromPublished(published.published, {
      releaseId: "meal-snapshot-a-broken",
      labels: SNAPSHOT_A_LABELS,
      captions: SNAPSHOT_A_CAPTIONS,
    });
    const releaseB = labeledReleaseFromPublished(published.published, {
      releaseId: "meal-snapshot-b-live",
      labels: SNAPSHOT_B_LABELS,
      captions: SNAPSHOT_B_CAPTIONS,
    });
    installActiveRelease(published.releases, releaseA);
    const { controller } = createNineWordLabHarness(published.releases);
    const started = await controller.start();
    assertKind(started, "PROBE_INTRO");

    published.releases.replaceRaw({
      ...releaseA,
      packSnapshot: releaseB.packSnapshot,
    });
    installActiveRelease(published.releases, releaseB, 2);

    const continued = await controller.continueProbe({
      runId: started.handle.runId,
      revision: started.handle.revision,
    });
    expect(continued.kind).toBe("ERROR");
    assertKind(continued, "ERROR");
    expect(continued.code).toContain(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE);
    expect(JSON.stringify(continued)).not.toContain(SNAPSHOT_B_LABELS.knife);
    expect(JSON.stringify(continued)).not.toContain("杯子");
  });

  it("fail-closes when the pinned frame id is missing from the snapshot", async () => {
    const published = await publishSyntheticNineWordRelease();
    const releaseA = labeledReleaseFromPublished(published.published, {
      releaseId: "meal-snapshot-a-frame",
      labels: SNAPSHOT_A_LABELS,
      captions: SNAPSHOT_A_CAPTIONS,
    });
    releaseA.contextSnapshot = {
      ...releaseA.contextSnapshot,
      frames: releaseA.contextSnapshot.frames.map((frame) =>
        frame.id === "home-breakfast-v0"
          ? { ...frame, id: "home-breakfast-missing-v0" }
          : frame,
      ),
    };
    const prints = fingerprintsForManifest(releaseA);
    releaseA.packFingerprint = prints.packFingerprint;
    releaseA.contextModelFingerprint = prints.contextModelFingerprint;
    releaseA.releaseFingerprint = prints.releaseFingerprint;
    installActiveRelease(published.releases, releaseA);

    const { controller } = createNineWordLabHarness(published.releases);
    const started = await controller.start();
    expect(started.kind).toBe("ERROR");
    assertKind(started, "ERROR");
    expect(started.code).toMatch(
      /PLANNER_FAILURE|MISSING_PUBLIC_PRESENTATION|CONTEXT_LAB_CONTENT_UNAVAILABLE/,
    );
    expect(JSON.stringify(started)).not.toContain(SNAPSHOT_B_LABELS.knife);
  });
});
