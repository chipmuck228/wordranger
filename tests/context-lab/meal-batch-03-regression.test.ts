import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MEAL_SCENE_EXPANSION_BATCH_03_PACK,
  experimentalMealContextLabPack,
} from "@/contextual-learning/candidate-v0/content";
import { mealColdProbeTargets } from "@/server/context-lab/meal-probe-targets";
import { loadContextLabContent } from "@/server/context-lab/context-lab-content-source";
import { loadContextLabPage } from "@/server/context-lab/load-context-lab-page";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import { createMealLabHarness } from "./helpers";
import { BATCH_03_LAB_ENV } from "./batch-03-release-helpers";

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(full)) {
      files.push(full);
    }
  }
  return files;
}

describe("MEAL_BATCH_03 planner compatibility regressions", () => {
  it("keeps static Context Lab on the six-word batch-02 pack", async () => {
    const { controller } = createMealLabHarness({ beginAt: "PROBE" });
    const screen = await controller.start();
    expect(screen.kind).toBe("PROBE_INTRO");
    if (screen.kind !== "PROBE_INTRO") {
      throw new Error(screen.kind);
    }
    expect(screen.progress.total).toBe(6);
    expect(experimentalMealContextLabPack().lexemes).toHaveLength(6);
    expect(mealColdProbeTargets()).toHaveLength(6);
    const staticContent = await loadContextLabContent({
      env: { CONTEXT_LAB_CONTENT_SOURCE: "static" },
    });
    expect(staticContent.pack.lexemes).toHaveLength(6);
    expect(staticContent.context.runtimeContextId).toBe("MEAL_BATCH_02");
  });

  it("does not let /train load the nine-word release", () => {
    for (const file of [
      ...walk("src/app/train"),
      ...walk("src/server/training"),
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("meal-scene-expansion-batch-03");
      expect(source, file).not.toContain("MEAL_BATCH_03");
      expect(source, file).not.toContain("loadContextLabContent");
      expect(source, file).not.toContain("CONTEXT_LAB_CONTENT_SOURCE");
    }
  });

  it("keeps napkin BLOCKED and out of the nine-word pack", () => {
    expect(
      MEAL_SCENE_EXPANSION_BATCH_03_PACK.lexemes.some((item) =>
        /napkin/i.test(`${item.id}${item.canonicalKey}${item.membership.presentationToken}`),
      ),
    ).toBe(false);
    expect(experimentalMealContextLabPack().lexemes.some((item) => /napkin/i.test(item.id))).toBe(
      false,
    );
  });

  it("feature flag disabled still 404s and missing pointer / bad fingerprint fail closed", async () => {
    expect(loadContextLabPage({}).kind).toBe("NOT_FOUND");
    expect(loadContextLabPage({ CONTEXT_LAB_ENABLED: "0" }).kind).toBe("NOT_FOUND");
    const empty = new InMemoryContextualContentReleaseRepository();
    await expect(
      loadContextLabContent({
        env: BATCH_03_LAB_ENV,
        repository: empty,
      }),
    ).rejects.toMatchObject({
      code: CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
    });
    await expect(
      loadContextLabContent({
        env: BATCH_03_LAB_ENV,
        repository: empty,
        pin: {
          releaseId: "meal-release-missing",
          releaseFingerprint: "not-a-real-fingerprint",
        },
      }),
    ).rejects.toMatchObject({
      code: CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
    });
  });
});
