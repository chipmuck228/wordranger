/**
 * Candidate-only Meal skeleton extension for batch 03.
 * Does not mutate the batch-02 or approved five-word skeletons.
 */

import type { SemanticSkeleton } from "../../domain/types";
import { mealBatch02Skeleton } from "./meal-batch-02-skeleton";

export const mealBatch03Skeleton: SemanticSkeleton = structuredClone(mealBatch02Skeleton);

mealBatch03Skeleton.roleDefinitions.push(
  {
    id: "SOLID_FOOD",
    label: "Solid food",
    cardinality: "OPTIONAL_ONE",
    accepts: [],
  },
  {
    id: "DRINKABLE_LIQUID",
    label: "Drinkable liquid",
    cardinality: "OPTIONAL_ONE",
    accepts: [],
  },
  {
    id: "WATER_VESSEL",
    label: "Water vessel",
    cardinality: "OPTIONAL_ONE",
    accepts: [],
  },
);

mealBatch03Skeleton.relationDefinitions.push(
  {
    id: "SUITABLE_FOR_CUTTING",
    label: "Suitable for cutting",
    fromRole: "EATING_TOOL",
    toRole: "SOLID_FOOD",
    directionality: "DIRECTED",
    temporalScope: "STATE",
  },
  {
    id: "CONTAINS_DRINKABLE",
    label: "Contains drinkable liquid",
    fromRole: "WATER_VESSEL",
    toRole: "DRINKABLE_LIQUID",
    directionality: "DIRECTED",
    temporalScope: "STATE",
  },
);
