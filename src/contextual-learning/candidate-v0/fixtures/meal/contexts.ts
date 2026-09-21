import type { ContextFrame, EntityBinding } from "../../domain/types";
import {
  FIXTURE_PROVENANCE,
  entityArg,
  fact,
} from "../shared";
import { MEAL_SENSE } from "./knowledge";
import { MEAL_SKELETON_ID } from "./skeleton";

const ACTIONS = [
  "IDENTIFY",
  "SELECT",
  "DISTINGUISH",
  "TYPE",
  "RECALL",
  "OBSERVE",
] as const;

function mealEntities(prefix: string, labels: {
  eater: string;
  food: string;
  container: string;
  spoon: string;
  fork: string;
  drink: string;
  cup: string;
}): EntityBinding[] {
  return [
    {
      entityId: `${prefix}-eater`,
      roleId: "EATER",
      label: labels.eater,
      conceptIds: [],
    },
    {
      entityId: `${prefix}-soup`,
      roleId: "FOOD",
      label: labels.food,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: MEAL_SENSE.soup, bindingKind: "NAMES_ENTITY" },
      ],
    },
    {
      entityId: `${prefix}-bowl`,
      roleId: "FOOD_CONTAINER",
      label: labels.container,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: MEAL_SENSE.bowl, bindingKind: "NAMES_ENTITY" },
      ],
    },
    {
      entityId: `${prefix}-spoon`,
      roleId: "EATING_TOOL",
      label: labels.spoon,
      conceptIds: ["concept-eating-tool"],
      lexemeSenseBindings: [
        { sense: MEAL_SENSE.spoon, bindingKind: "NAMES_ENTITY" },
      ],
    },
    {
      entityId: `${prefix}-fork`,
      roleId: "EATING_TOOL",
      label: labels.fork,
      conceptIds: ["concept-eating-tool"],
      lexemeSenseBindings: [
        { sense: MEAL_SENSE.fork, bindingKind: "NAMES_ENTITY" },
      ],
    },
    {
      entityId: `${prefix}-drink`,
      roleId: "DRINK",
      label: labels.drink,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: MEAL_SENSE.drink, bindingKind: "NAMES_ENTITY" },
      ],
    },
    {
      entityId: `${prefix}-cup`,
      roleId: "DRINK_CONTAINER",
      label: labels.cup,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: MEAL_SENSE.cup, bindingKind: "NAMES_ENTITY" },
      ],
    },
  ];
}

function mealFacts(prefix: string): ContextFrame["initialFacts"] {
  return [
    fact(
      "contains",
      [entityArg(`${prefix}-bowl`), entityArg(`${prefix}-soup`)],
      `${prefix}-fact-contains-bowl-soup`,
    ),
    fact(
      "contains",
      [entityArg(`${prefix}-cup`), entityArg(`${prefix}-drink`)],
      `${prefix}-fact-contains-cup-drink`,
    ),
    fact(
      "suitable_for",
      [entityArg(`${prefix}-spoon`), entityArg(`${prefix}-soup`)],
      `${prefix}-fact-suitable-for-spoon-soup`,
    ),
  ];
}

function mealFrame(
  id: string,
  title: string,
  prefix: string,
  labels: Parameters<typeof mealEntities>[1],
  setup: string,
): ContextFrame {
  return {
    id,
    skeletonId: MEAL_SKELETON_ID,
    title,
    kinds: ["PHYSICAL", "EVENT"],
    locale: "en",
    entityBindings: mealEntities(prefix, labels),
    initialFacts: mealFacts(prefix),
    goalBindings: [{ goalId: "EATER_CAN_EAT_FOOD", active: true }],
    narrative: { setup },
    allowedSemanticActions: [...ACTIONS],
    contentTags: ["meal", prefix],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  };
}

export const homeBreakfastFrame = mealFrame(
  "home-breakfast-v0",
  "Home breakfast",
  "home",
  {
    eater: "Child at home",
    food: "Breakfast soup",
    container: "Home bowl",
    spoon: "Home spoon",
    fork: "Home fork",
    drink: "Milk",
    cup: "Home cup",
  },
  "A child is eating breakfast soup at the kitchen table.",
);

export const restaurantMealFrame = mealFrame(
  "restaurant-meal-v0",
  "Restaurant meal",
  "rest",
  {
    eater: "Customer",
    food: "Restaurant soup",
    container: "Restaurant bowl",
    spoon: "Restaurant spoon",
    fork: "Restaurant fork",
    drink: "Tea",
    cup: "Restaurant cup",
  },
  "A customer is served soup at a restaurant table.",
);

export const picnicLunchFrame = mealFrame(
  "picnic-lunch-v0",
  "Picnic lunch",
  "picnic",
  {
    eater: "Picnic eater",
    food: "Thermos soup",
    container: "Picnic bowl",
    spoon: "Picnic spoon",
    fork: "Picnic fork",
    drink: "Juice",
    cup: "Picnic cup",
  },
  "Friends eat packed soup outdoors.",
);

export const MEAL_FRAMES = [
  homeBreakfastFrame,
  restaurantMealFrame,
  picnicLunchFrame,
] as const;

export function mealPrefixForFrame(frameId: string): string {
  if (frameId === restaurantMealFrame.id) {
    return "rest";
  }
  if (frameId === picnicLunchFrame.id) {
    return "picnic";
  }
  return "home";
}
