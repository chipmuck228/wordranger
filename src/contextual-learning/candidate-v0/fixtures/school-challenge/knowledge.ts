import type {
  ContrastSet,
  Misconception,
  SemanticConcept,
} from "../../domain/types";
import { FIXTURE_PROVENANCE, pred, profile, sense } from "../shared";

export const SCHOOL_SENSE = {
  ability: sense("lex-ability", "ability#current-capacity"),
  possible: sense("lex-possible", "possible#goal-reachable"),
  difficult: sense("lex-difficult", "difficult#high-requirement"),
  try: sense("lex-try", "try#attempt-action"),
  improve: sense("lex-improve", "improve#state-increase"),
  practice: sense("lex-practice", "practice#repeated-attempt"),
  success: sense("lex-success", "success#goal-satisfied"),
  challenge: sense("lex-challenge", "challenge#goal-task"),
  result: sense("lex-result", "result#outcome"),
  plan: sense("lex-plan", "plan#strategy"),
} as const;

export const SCHOOL_CONCEPTS: SemanticConcept[] = [
  {
    id: "concept-attempt",
    label: "Attempt",
    kind: "ACTION",
    gloss: "An effort toward a goal, not the same as success",
    provenance: FIXTURE_PROVENANCE,
  },
  {
    id: "concept-success-outcome",
    label: "Success",
    kind: "OUTCOME",
    gloss: "The goal predicate is satisfied",
    provenance: FIXTURE_PROVENANCE,
  },
  {
    id: "concept-ability-property",
    label: "Ability",
    kind: "PROPERTY",
    gloss: "Current capacity relative to one skill, not a global trait",
    provenance: FIXTURE_PROVENANCE,
  },
];

export const SCHOOL_PROFILES = [
  profile(SCHOOL_SENSE.ability, "ability", ["concept-ability-property"]),
  profile(SCHOOL_SENSE.possible, "possible", []),
  profile(SCHOOL_SENSE.difficult, "difficult", []),
  profile(SCHOOL_SENSE.try, "try", ["concept-attempt"]),
  profile(SCHOOL_SENSE.improve, "improve", []),
  profile(SCHOOL_SENSE.practice, "practice", []),
  profile(SCHOOL_SENSE.success, "success", ["concept-success-outcome"]),
  profile(SCHOOL_SENSE.challenge, "challenge", []),
  profile(SCHOOL_SENSE.result, "result", []),
  profile(SCHOOL_SENSE.plan, "plan", []),
];

export const SCHOOL_CONTRASTS: ContrastSet[] = [
  {
    id: "contrast-try-success",
    members: [SCHOOL_SENSE.try, SCHOOL_SENSE.success],
    discriminators: [
      {
        id: "disc-effort-vs-goal",
        dimension: "goal-satisfaction",
        rule: pred("goal_satisfied", [], true),
      },
    ],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
];

export const SCHOOL_MISCONCEPTIONS: Misconception[] = [
  {
    id: "misc-local-success-is-general-ability",
    appliesTo: [SCHOOL_SENSE.ability, SCHOOL_SENSE.success],
    incorrectClaim: pred("has_general_ability", [], true),
    correction: pred("ability_is_skill_scoped", [], true),
    supportBlockId: "school-support-contrast",
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
];
