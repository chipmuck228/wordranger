import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LearningTaskType } from "@/domain/tasks/task-type";
import {
  mealBuildPlanningInput,
  prepareMealContextLab,
} from "@/server/context-lab/prepare-meal-context-lab";
import { collectKeys, FORBIDDEN_CLIENT_FIELDS, serializedContains } from "./helpers";

const PREPARE_SOURCE = readFileSync(
  join(process.cwd(), "src/server/context-lab/prepare-meal-context-lab.ts"),
  "utf8",
);

describe("Meal Context Lab preparation", () => {
  it("selects Meal BUILD through planExperience, not a hard-coded plan", () => {
    expect(PREPARE_SOURCE).toContain("planExperience");
    expect(PREPARE_SOURCE).toContain("mealBuildPlanningInput");
    expect(PREPARE_SOURCE).not.toContain("createMealBuildPlan");
    expect(PREPARE_SOURCE).not.toMatch(/plan\.id\.startsWith|variantId\.startsWith/);

    const payload = prepareMealContextLab();
    const guided = payload.screens.filter((screen) => screen.kind === "GUIDED");
    expect(guided).toHaveLength(3);
    expect(guided[0]?.activity.contextFrameId).toBe("home-breakfast-v0");
    expect(payload.screens.some((screen) => screen.kind === "ERROR")).toBe(false);
  });

  it("renders a controlled error when the typing capability is missing", () => {
    const payload = prepareMealContextLab({
      planningInput: mealBuildPlanningInput([]),
    });
    expect(payload.screens).toHaveLength(1);
    expect(payload.screens[0]).toMatchObject({
      kind: "ERROR",
      title: "这个体验暂时无法加载。",
    });
    if (payload.screens[0]?.kind !== "ERROR") {
      throw new Error("missing capability must be an error");
    }
    expect(payload.screens[0].code).toContain("PLANNER_FAILURE");
  });

  it("step 1 presents soup, bowl, spoon, and fork without a correct-answer claim", () => {
    const first = prepareMealContextLab().screens[0];
    expect(first?.kind).toBe("GUIDED");
    if (first?.kind !== "GUIDED") {
      throw new Error("first screen must be guided");
    }
    expect(first.context.entities.map((entity) => entity.label)).toEqual([
      "汤",
      "碗",
      "勺子",
      "叉子",
    ]);
    expect(first.context.highlightedEntityIds).toEqual([]);
    expect(first.activity.completionContract.kind).toBe("ACKNOWLEDGE_ONLY");
    expect(first.context.relationCaption).toBeUndefined();
  });

  it("step 2 highlights only grounded entities and shows the grounded relation", () => {
    const second = prepareMealContextLab().screens[1];
    expect(second?.kind).toBe("GUIDED");
    if (second?.kind !== "GUIDED") {
      throw new Error("second screen must be guided");
    }
    expect(second.context.highlightedEntityIds).toEqual(["home-spoon", "home-soup"]);
    expect(second.activity.presentedFactPredicates).toEqual(["suitable_for"]);
    expect(second.context.relationCaption).toBe("勺子 → 适合舀汤");
  });

  it("step 3 presents contrast without a scored response", () => {
    const third = prepareMealContextLab().screens[2];
    expect(third?.kind).toBe("GUIDED");
    if (third?.kind !== "GUIDED") {
      throw new Error("third screen must be guided");
    }
    expect(third.activity.completionContract.kind).toBe("ACKNOWLEDGE_ONLY");
    expect(third.context.contrastCaptions).toEqual([
      { entityId: "home-spoon", caption: "勺子：舀取汤或柔软食物" },
      { entityId: "home-fork", caption: "叉子：叉取食物块" },
    ]);
    expect(serializedContains(third, "correctOptionIds")).toBe(false);
  });

  it("step 4 receives a real PublicLearningTask and no TaskAnswerKey", () => {
    const preview = prepareMealContextLab().screens.find(
      (screen) => screen.kind === "FROZEN_TASK_PREVIEW",
    );
    expect(preview?.kind).toBe("FROZEN_TASK_PREVIEW");
    if (preview?.kind !== "FROZEN_TASK_PREVIEW") {
      throw new Error("frozen preview is required");
    }
    expect(preview.task.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
    expect(preview.task.responseContract.kind).toBe("TEXT_INPUT");
    expect(preview.task.prompt.kind).toBe("MEANING_TEXT");
    expect("answerKey" in preview).toBe(false);
    expect("answerKey" in preview.task).toBe(false);
  });

  it("stops at FROZEN_TASK_HANDOFF_READY without claiming completion", () => {
    const payload = prepareMealContextLab();
    const kinds = payload.screens.map((screen) => screen.kind);
    expect(kinds).toEqual([
      "GUIDED",
      "GUIDED",
      "GUIDED",
      "FROZEN_TASK_PREVIEW",
      "PILOT_BOUNDARY",
    ]);
    const boundary = payload.screens[4];
    expect(boundary?.kind).toBe("PILOT_BOUNDARY");
    if (boundary?.kind !== "PILOT_BOUNDARY") {
      throw new Error("boundary screen required");
    }
    expect(boundary.message).toContain("交接点");
    expect(boundary.message).not.toMatch(/掌握|学完|答对|完成学习/);
  });

  it("serialized client props contain no forbidden answer or evidence fields", () => {
    const payload = prepareMealContextLab();
    const keys = collectKeys(payload);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("LearningEvidence");
    expect(serialized).not.toContain("StudentLexemeModel");
    expect(serialized).not.toContain("exactAcceptedTexts");
  });
});
