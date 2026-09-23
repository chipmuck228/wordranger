/**
 * Candidate-only Meal frames for batch 02.
 * Deep-cloned from the approved five-word frames. Does not mutate MEAL_FRAMES.
 */

import type { ContextFrame } from "../../domain/types";
import { entityArg, fact } from "../shared";
import {
  homeBreakfastFrame,
  picnicLunchFrame,
  restaurantMealFrame,
} from "./contexts";
import { MEAL_SENSE } from "./knowledge";

function withPlateSupport(
  frame: ContextFrame,
  prefix: string,
  labels: { plate: string; servedFood: string },
): ContextFrame {
  const next = structuredClone(frame);
  next.entityBindings.push(
    {
      entityId: `${prefix}-plate`,
      roleId: "FOOD_SUPPORT",
      label: labels.plate,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: MEAL_SENSE.plate, bindingKind: "NAMES_ENTITY" },
      ],
    },
    {
      entityId: `${prefix}-served-food`,
      roleId: "SUPPORTED_FOOD",
      label: labels.servedFood,
      conceptIds: [],
    },
  );
  next.initialFacts.push(
    fact(
      "supports",
      [entityArg(`${prefix}-plate`), entityArg(`${prefix}-served-food`)],
      `${prefix}-fact-supports-plate-food`,
    ),
  );
  return next;
}

export const homeBreakfastBatch02Frame = withPlateSupport(
  homeBreakfastFrame,
  "home",
  { plate: "Home plate", servedFood: "Food on the plate" },
);

export const restaurantMealBatch02Frame = withPlateSupport(
  restaurantMealFrame,
  "rest",
  { plate: "Restaurant plate", servedFood: "Food on the plate" },
);

export const picnicLunchBatch02Frame = withPlateSupport(
  picnicLunchFrame,
  "picnic",
  { plate: "Picnic plate", servedFood: "Food on the plate" },
);

export const MEAL_BATCH_02_FRAMES = [
  homeBreakfastBatch02Frame,
  restaurantMealBatch02Frame,
  picnicLunchBatch02Frame,
] as const;

export function mealBatch02AuthoredFrames(): ContextFrame[] {
  return [homeBreakfastBatch02Frame, restaurantMealBatch02Frame].map((frame) =>
    structuredClone(frame),
  );
}
