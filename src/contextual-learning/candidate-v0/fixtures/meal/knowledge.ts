import type {
  ContrastSet,
  Misconception,
  SemanticConcept,
} from "../../domain/types";
import {
  FIXTURE_PROVENANCE,
  pred,
  profile,
  sense,
} from "../shared";

export const MEAL_SENSE = {
  spoon: sense("lex-spoon", "spoon#eating-utensil"),
  fork: sense("lex-fork", "fork#eating-utensil"),
  bowl: sense("lex-bowl", "bowl#food-container"),
  plate: sense("lex-plate", "plate#food-support"),
  cup: sense("lex-cup", "cup#drink-container"),
  soup: sense("lex-soup", "soup#liquid-food"),
  eat: sense("lex-eat", "eat#consume-food"),
  drink: sense("lex-drink", "drink#consume-liquid"),
  choose: sense("lex-choose", "choose#select"),
  knife: sense("lex-knife", "knife#eating-tool"),
  bread: sense("lex-bread", "bread#solid-food"),
  water: sense("lex-water", "water#drinkable-liquid"),
} as const;

export const MEAL_CONCEPTS: SemanticConcept[] = [
  {
    id: "concept-eating-tool",
    label: "Eating tool",
    kind: "ENTITY_TYPE",
    gloss: "An implement used to move food to the mouth",
    provenance: FIXTURE_PROVENANCE,
  },
  {
    id: "concept-suitable-for",
    label: "Suitable for",
    kind: "RELATION",
    gloss: "A contextual fit between a tool and a food state",
    provenance: FIXTURE_PROVENANCE,
  },
];

export const MEAL_PROFILES = [
  profile(MEAL_SENSE.spoon, "spoon", ["concept-eating-tool"]),
  profile(MEAL_SENSE.fork, "fork", ["concept-eating-tool"]),
  profile(MEAL_SENSE.bowl, "bowl", []),
  profile(MEAL_SENSE.plate, "plate", []),
  profile(MEAL_SENSE.cup, "cup", []),
  profile(MEAL_SENSE.soup, "soup", []),
  profile(MEAL_SENSE.eat, "eat", []),
  profile(MEAL_SENSE.drink, "drink", []),
  profile(MEAL_SENSE.choose, "choose", []),
  profile(MEAL_SENSE.knife, "knife", ["concept-eating-tool"]),
  profile(MEAL_SENSE.bread, "bread", []),
  profile(MEAL_SENSE.water, "water", []),
];

export const MEAL_CONTRASTS: ContrastSet[] = [
  {
    id: "contrast-spoon-fork",
    members: [MEAL_SENSE.spoon, MEAL_SENSE.fork],
    discriminators: [
      {
        id: "disc-soup-vs-pierce",
        dimension: "food-state-fit",
        rule: pred("suitable_for_liquid_food", [], true),
      },
    ],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  {
    id: "contrast-bowl-plate",
    members: [MEAL_SENSE.bowl, MEAL_SENSE.plate],
    discriminators: [],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  {
    id: "contrast-cup-bowl",
    members: [MEAL_SENSE.cup, MEAL_SENSE.bowl],
    discriminators: [],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
];

export const MEAL_MISCONCEPTIONS: Misconception[] = [
  {
    id: "misc-spoon-equals-fork",
    appliesTo: [MEAL_SENSE.spoon, MEAL_SENSE.fork],
    incorrectClaim: pred("always_interchangeable", [], true),
    correction: pred("suitability_depends_on_food_state", [], true),
    supportBlockId: "meal-support-contrast",
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
];
