import type {
  ClaimGrounding,
  ContextFrame,
  EntityBinding,
} from "../../domain/types";
import {
  FIXTURE_PROVENANCE,
  entityArg,
  fact,
  literalArg,
  pred,
} from "../shared";
import { SCHOOL_SENSE } from "./knowledge";
import { SCHOOL_SKELETON_ID } from "./skeleton";

const ACTIONS = [
  "IDENTIFY",
  "SELECT",
  "DISTINGUISH",
  "TYPE",
  "RECALL",
  "OBSERVE",
  "CONNECT",
] as const;

function schoolEntities(
  prefix: string,
  labels: Record<
    "challenger" | "challenge" | "skill" | "attempt1" | "attempt2" | "strategy" | "outcome",
    string
  >,
): EntityBinding[] {
  return [
    {
      entityId: `${prefix}-challenger`,
      roleId: "CHALLENGER",
      label: labels.challenger,
      conceptIds: ["concept-ability-property"],
      lexemeSenseBindings: [
        { sense: SCHOOL_SENSE.ability, bindingKind: "NAMES_PROPERTY" },
      ],
    },
    {
      entityId: `${prefix}-challenge`,
      roleId: "CHALLENGE",
      label: labels.challenge,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: SCHOOL_SENSE.challenge, bindingKind: "NAMES_ENTITY" },
        { sense: SCHOOL_SENSE.difficult, bindingKind: "EXPRESSES_CLAIM" },
        { sense: SCHOOL_SENSE.possible, bindingKind: "EXPRESSES_CLAIM" },
      ],
    },
    {
      entityId: `${prefix}-skill`,
      roleId: "SKILL",
      label: labels.skill,
      conceptIds: [],
    },
    {
      entityId: `${prefix}-attempt-1`,
      roleId: "ATTEMPT",
      label: labels.attempt1,
      conceptIds: ["concept-attempt"],
      lexemeSenseBindings: [
        { sense: SCHOOL_SENSE.try, bindingKind: "NAMES_ACTION" },
      ],
    },
    {
      entityId: `${prefix}-attempt-2`,
      roleId: "ATTEMPT",
      label: labels.attempt2,
      conceptIds: ["concept-attempt"],
      lexemeSenseBindings: [
        { sense: SCHOOL_SENSE.improve, bindingKind: "NAMES_STATE" },
      ],
    },
    {
      entityId: `${prefix}-strategy`,
      roleId: "STRATEGY",
      label: labels.strategy,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: SCHOOL_SENSE.plan, bindingKind: "NAMES_ENTITY" },
        { sense: SCHOOL_SENSE.practice, bindingKind: "NAMES_ACTION" },
      ],
    },
    {
      entityId: `${prefix}-outcome`,
      roleId: "OUTCOME",
      label: labels.outcome,
      conceptIds: ["concept-success-outcome"],
      lexemeSenseBindings: [
        { sense: SCHOOL_SENSE.success, bindingKind: "EXPRESSES_CLAIM" },
        { sense: SCHOOL_SENSE.result, bindingKind: "NAMES_OUTCOME" },
      ],
    },
  ];
}

function schoolFacts(prefix: string): ContextFrame["initialFacts"] {
  return [
    fact("skill_level", [entityArg(`${prefix}-challenger`), literalArg(2)]),
    fact("challenge_requirement", [
      entityArg(`${prefix}-challenge`),
      literalArg(4),
    ]),
    fact("attempt_status", [entityArg(`${prefix}-attempt-1`), literalArg("fell")]),
    fact("attempt_status", [
      entityArg(`${prefix}-attempt-2`),
      literalArg("stood-30s"),
    ]),
    fact("goal_requires_seconds", [
      entityArg(`${prefix}-challenge`),
      literalArg(20),
    ]),
    fact("changed_strategy", [
      entityArg(`${prefix}-strategy`),
      entityArg(`${prefix}-attempt-2`),
    ]),
    fact("goal_satisfied", [entityArg(`${prefix}-attempt-2`)]),
    fact("performance_improved", [
      entityArg(`${prefix}-attempt-1`),
      entityArg(`${prefix}-attempt-2`),
    ]),
  ];
}

function schoolGroundings(prefix: string): ClaimGrounding[] {
  return [
    {
      sense: SCHOOL_SENSE.possible,
      claim: pred("possible_under_current_facts", [
        entityArg(`${prefix}-challenge`),
      ]),
      supportingFacts: [
        pred("changed_strategy", [
          entityArg(`${prefix}-strategy`),
          entityArg(`${prefix}-attempt-2`),
        ]),
        pred("goal_satisfied", [entityArg(`${prefix}-attempt-2`)]),
      ],
      scopedTo: pred("scoped_to_challenge", [entityArg(`${prefix}-challenge`)]),
    },
    {
      sense: SCHOOL_SENSE.difficult,
      claim: pred("requirement_exceeds_current_skill", [
        entityArg(`${prefix}-challenge`),
        entityArg(`${prefix}-challenger`),
      ]),
      supportingFacts: [
        pred("skill_level", [entityArg(`${prefix}-challenger`), literalArg(2)]),
        pred("challenge_requirement", [
          entityArg(`${prefix}-challenge`),
          literalArg(4),
        ]),
      ],
      scopedTo: pred("baseline_is_current_skill", [
        entityArg(`${prefix}-skill`),
      ]),
    },
    {
      sense: SCHOOL_SENSE.success,
      claim: pred("goal_satisfied", [entityArg(`${prefix}-attempt-2`)]),
      supportingFacts: [
        pred("attempt_status", [
          entityArg(`${prefix}-attempt-2`),
          literalArg("stood-30s"),
        ]),
        pred("goal_requires_seconds", [
          entityArg(`${prefix}-challenge`),
          literalArg(20),
        ]),
      ],
      scopedTo: pred("scoped_to_challenge", [entityArg(`${prefix}-challenge`)]),
    },
  ];
}

function schoolFrame(
  id: string,
  title: string,
  prefix: string,
  labels: Parameters<typeof schoolEntities>[1],
  setup: string,
): ContextFrame {
  return {
    id,
    skeletonId: SCHOOL_SKELETON_ID,
    title,
    kinds: ["EVENT", "CONCEPTUAL"],
    locale: "en",
    entityBindings: schoolEntities(prefix, labels),
    initialFacts: schoolFacts(prefix),
    goalBindings: [{ goalId: "COMPLETE_CHALLENGE", active: true }],
    narrative: { setup },
    allowedSemanticActions: [...ACTIONS],
    claimGroundings: schoolGroundings(prefix),
    contentTags: ["school-challenge", prefix],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  };
}

export const scienceTowerFrame = schoolFrame(
  "science-tower-v0",
  "Science tower challenge",
  "tower",
  {
    challenger: "Student builder",
    challenge: "Paper tower must stand 20 seconds",
    skill: "Building skill",
    attempt1: "Attempt 1 fell",
    attempt2: "Attempt 2 stood 30 seconds",
    strategy: "Widen the base",
    outcome: "Goal satisfied on attempt 2",
  },
  "The tower fell on attempt 1. The learner changed the base. The tower stood 30 seconds on attempt 2.",
);

export const schoolQuizFrame = schoolFrame(
  "school-quiz-v0",
  "School quiz team",
  "quiz",
  {
    challenger: "Quiz team",
    challenge: "Answer the set together",
    skill: "Topic knowledge",
    attempt1: "First practice quiz missed items",
    attempt2: "Second quiz met the pass mark",
    strategy: "Prepare as a group",
    outcome: "Pass mark reached",
  },
  "The team missed items on the first practice and later met the pass mark.",
);

export const sportsRelayFrame = schoolFrame(
  "sports-relay-v0",
  "Sports-day relay planning",
  "relay",
  {
    challenger: "Relay team",
    challenge: "Finish the relay",
    skill: "Coordination",
    attempt1: "First order dropped the baton",
    attempt2: "Revised order completed the race",
    strategy: "Change runner order",
    outcome: "Relay completed",
  },
  "The first order dropped the baton. The revised order completed the race.",
);

export const SCHOOL_FRAMES = [
  scienceTowerFrame,
  schoolQuizFrame,
  sportsRelayFrame,
] as const;

export function schoolPrefixForFrame(frameId: string): string {
  if (frameId === schoolQuizFrame.id) {
    return "quiz";
  }
  if (frameId === sportsRelayFrame.id) {
    return "relay";
  }
  return "tower";
}
