/**
 * Candidate-only Meal skeleton extension for batch 02.
 * Does not mutate the approved five-word mealSkeleton.
 */

import type { SemanticSkeleton } from "../../domain/types";
import { mealSkeleton } from "./skeleton";

export const mealBatch02Skeleton: SemanticSkeleton = structuredClone(mealSkeleton);

mealBatch02Skeleton.roleDefinitions.push(
  {
    id: "FOOD_SUPPORT",
    label: "Food support",
    cardinality: "OPTIONAL_ONE",
    accepts: [],
  },
  {
    id: "SUPPORTED_FOOD",
    label: "Supported food",
    cardinality: "OPTIONAL_ONE",
    accepts: [],
  },
);

const containsFoodIndex = mealBatch02Skeleton.relationDefinitions.findIndex(
  (item) => item.id === "CONTAINS_FOOD",
);
mealBatch02Skeleton.relationDefinitions.splice(containsFoodIndex + 1, 0, {
  id: "SUPPORTS_FOOD",
  label: "Supports food",
  fromRole: "FOOD_SUPPORT",
  toRole: "SUPPORTED_FOOD",
  directionality: "DIRECTED",
  temporalScope: "STATE",
});
