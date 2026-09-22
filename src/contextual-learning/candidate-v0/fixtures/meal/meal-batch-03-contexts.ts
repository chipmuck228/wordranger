/**
 * Candidate-only Meal frames for batch 03.
 * Deep-cloned from batch 02. Does not mutate MEAL_BATCH_02_FRAMES.
 */

import type { ContextFrame } from "../../domain/types";
import { entityArg, fact } from "../shared";
import { MEAL_SENSE } from "./knowledge";
import {
  homeBreakfastBatch02Frame,
  picnicLunchBatch02Frame,
  restaurantMealBatch02Frame,
} from "./meal-batch-02-contexts";

function withBatch03Objects(
  frame: ContextFrame,
  prefix: string,
  labels: { knife: string; bread: string; water: string; vessel: string },
): ContextFrame {
  const next = structuredClone(frame);
  next.entityBindings.push(
    {
      entityId: `${prefix}-knife`,
      roleId: "EATING_TOOL",
      label: labels.knife,
      conceptIds: ["concept-eating-tool"],
      lexemeSenseBindings: [{ sense: MEAL_SENSE.knife, bindingKind: "NAMES_ENTITY" }],
    },
    {
      entityId: `${prefix}-bread`,
      roleId: "SOLID_FOOD",
      label: labels.bread,
      conceptIds: [],
      lexemeSenseBindings: [{ sense: MEAL_SENSE.bread, bindingKind: "NAMES_ENTITY" }],
    },
    {
      entityId: `${prefix}-water`,
      roleId: "DRINKABLE_LIQUID",
      label: labels.water,
      conceptIds: [],
      lexemeSenseBindings: [{ sense: MEAL_SENSE.water, bindingKind: "NAMES_ENTITY" }],
    },
    {
      entityId: `${prefix}-water-vessel`,
      roleId: "WATER_VESSEL",
      label: labels.vessel,
      conceptIds: [],
    },
  );
  next.initialFacts.push(
    fact(
      "suitable_for",
      [entityArg(`${prefix}-knife`), entityArg(`${prefix}-bread`)],
      `${prefix}-fact-suitable-for-knife-bread`,
    ),
    fact(
      "contains",
      [entityArg(`${prefix}-water-vessel`), entityArg(`${prefix}-water`)],
      `${prefix}-fact-contains-vessel-water`,
    ),
  );
  return next;
}

export const homeBreakfastBatch03Frame = withBatch03Objects(
  homeBreakfastBatch02Frame,
  "home",
  {
    knife: "Home knife",
    bread: "Breakfast bread",
    water: "Drinking water",
    vessel: "Home water carafe",
  },
);

export const restaurantMealBatch03Frame = withBatch03Objects(
  restaurantMealBatch02Frame,
  "rest",
  {
    knife: "Restaurant knife",
    bread: "Table bread",
    water: "Drinking water",
    vessel: "Restaurant water carafe",
  },
);

export const picnicLunchBatch03Frame = withBatch03Objects(
  picnicLunchBatch02Frame,
  "picnic",
  {
    knife: "Picnic knife",
    bread: "Packed bread",
    water: "Drinking water",
    vessel: "Picnic water bottle",
  },
);

export const MEAL_BATCH_03_FRAMES = [
  homeBreakfastBatch03Frame,
  restaurantMealBatch03Frame,
  picnicLunchBatch03Frame,
] as const;
