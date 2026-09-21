/**
 * Plan helpers for Meal Scene expansion batch 01.
 * Candidate / Experimental / Not Approved.
 *
 * Resolves the Candidate expansion pack. Does not change Context Lab
 * or the approved four-word runtime pack.
 */

import type { ContextFrame, LearningExperiencePlan } from "../../domain/types";
import { resolveSceneContent } from "../../content/resolve-scene-content";
import type { SceneLexemeLoader } from "../../content/types";
import type { LexemeSenseRef } from "../../domain/types";
import { MEAL_SCENE_CLUSTER } from "../../memory-routing/scene-catalog";
import {
  createContextualLexicalBuildPlan,
  createContextualLexicalStrengthenPlan,
} from "../../planning/create-contextual-lexical-plans";
import { FIXTURE_PROVENANCE, completeAll } from "../shared";
import { MEAL_FRAMES, mealPrefixForFrame } from "./contexts";
import { MEAL_SKELETON_ID, mealSkeleton } from "./skeleton";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "../../content/packs/meal/meal-scene-expansion-batch-01";

function emptyExpansionPlan(
  frame: ContextFrame,
  mode: "BUILD" | "STRENGTHEN",
): LearningExperiencePlan {
  return {
    id: `meal-expansion-batch-01-${mode.toLowerCase()}-${frame.id}-unresolved`,
    schemaVersion: "candidate-v0",
    mode,
    sourceLearningNeedRef: "need-opaque-ref",
    targets: [],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps: [],
    completionPolicy: completeAll([]),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function resolveExpansionBatch01ForFrame(
  frame: ContextFrame,
  loadLexeme?: SceneLexemeLoader,
) {
  if (!loadLexeme) {
    return null;
  }
  const resolved = resolveSceneContent({
    pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
    frame,
    frames: MEAL_FRAMES.filter((item) => item.id !== "picnic-lunch-v0"),
    skeleton: mealSkeleton,
    cluster: MEAL_SCENE_CLUSTER,
    loadLexeme,
  });
  return resolved.ok ? resolved.content : null;
}

export function createExpansionBatch01LexicalBuildPlan(input: {
  frame: ContextFrame;
  target: LexemeSenseRef;
  loadLexeme?: SceneLexemeLoader;
}): LearningExperiencePlan {
  const content = resolveExpansionBatch01ForFrame(input.frame, input.loadLexeme);
  if (!content) {
    return emptyExpansionPlan(input.frame, "BUILD");
  }
  return createContextualLexicalBuildPlan({
    frame: input.frame,
    content,
    target: input.target,
    stepIdPrefix: mealPrefixForFrame(input.frame.id),
  });
}

export function createExpansionBatch01LexicalStrengthenPlan(input: {
  frame: ContextFrame;
  target: LexemeSenseRef;
  loadLexeme?: SceneLexemeLoader;
}): LearningExperiencePlan {
  const content = resolveExpansionBatch01ForFrame(input.frame, input.loadLexeme);
  if (!content) {
    return emptyExpansionPlan(input.frame, "STRENGTHEN");
  }
  return createContextualLexicalStrengthenPlan({
    frame: input.frame,
    content,
    target: input.target,
    stepIdPrefix: mealPrefixForFrame(input.frame.id),
  });
}
