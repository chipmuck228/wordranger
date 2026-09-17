import type { SemanticSkeleton } from "../../domain/types";
import { pred, roleArg, FIXTURE_PROVENANCE } from "../shared";

export const MEAL_SKELETON_ID = "meal-setting-v0";

export const mealSkeleton: SemanticSkeleton = {
  id: MEAL_SKELETON_ID,
  version: 0,
  title: "Meal setting",
  description:
    "Reusable roles and relations for eating: eater, food, containers, and tools.",
  supportedContextKinds: ["PHYSICAL", "EVENT"],
  roleDefinitions: [
    { id: "EATER", label: "Eater", cardinality: "ONE", accepts: [] },
    { id: "FOOD", label: "Food", cardinality: "ONE", accepts: [] },
    {
      id: "FOOD_CONTAINER",
      label: "Food container",
      cardinality: "ONE",
      accepts: [],
    },
    { id: "EATING_TOOL", label: "Eating tool", cardinality: "MANY", accepts: [] },
    { id: "DRINK", label: "Drink", cardinality: "OPTIONAL_ONE", accepts: [] },
    {
      id: "DRINK_CONTAINER",
      label: "Drink container",
      cardinality: "OPTIONAL_ONE",
      accepts: [],
    },
  ],
  relationDefinitions: [
    {
      id: "CONTAINS_FOOD",
      label: "Contains food",
      fromRole: "FOOD_CONTAINER",
      toRole: "FOOD",
      directionality: "DIRECTED",
      temporalScope: "STATE",
    },
    {
      id: "CONTAINS_DRINK",
      label: "Contains drink",
      fromRole: "DRINK_CONTAINER",
      toRole: "DRINK",
      directionality: "DIRECTED",
      temporalScope: "STATE",
    },
    {
      id: "SUITABLE_FOR",
      label: "Suitable for",
      fromRole: "EATING_TOOL",
      toRole: "FOOD",
      directionality: "DIRECTED",
      temporalScope: "STATE",
    },
  ],
  eventDefinitions: [
    {
      id: "CHOOSE_TOOL",
      participantRoles: ["EATER", "EATING_TOOL", "FOOD"],
      preconditions: [],
      effects: [],
    },
  ],
  affordanceDefinitions: [
    {
      id: "identify-tool",
      actorRole: "EATER",
      action: "IDENTIFY",
      objectRole: "EATING_TOOL",
      enabledWhen: [],
    },
    {
      id: "select-tool",
      actorRole: "EATER",
      action: "SELECT",
      objectRole: "EATING_TOOL",
      enabledWhen: [],
    },
    {
      id: "distinguish-tool",
      actorRole: "EATER",
      action: "DISTINGUISH",
      objectRole: "EATING_TOOL",
      enabledWhen: [],
    },
    {
      id: "type-tool",
      actorRole: "EATER",
      action: "TYPE",
      objectRole: "EATING_TOOL",
      enabledWhen: [],
    },
    {
      id: "recall-tool",
      actorRole: "EATER",
      action: "RECALL",
      objectRole: "EATING_TOOL",
      enabledWhen: [],
    },
    {
      id: "observe-meal",
      actorRole: "EATER",
      action: "OBSERVE",
      enabledWhen: [],
    },
  ],
  goalDefinitions: [
    {
      id: "EATER_CAN_EAT_FOOD",
      description: "The eater can eat the food with a suitable tool",
      successPredicate: pred("can_eat", [roleArg("EATER"), roleArg("FOOD")], true),
    },
  ],
  validationRules: [],
  provenance: FIXTURE_PROVENANCE,
  reviewStatus: "REVIEWED",
};
