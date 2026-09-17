import type { SemanticSkeleton } from "../../domain/types";
import { FIXTURE_PROVENANCE, pred, roleArg } from "../shared";

export const SCHOOL_SKELETON_ID = "goal-directed-challenge-v0";

export const schoolChallengeSkeleton: SemanticSkeleton = {
  id: SCHOOL_SKELETON_ID,
  version: 0,
  title: "Goal-directed challenge",
  description:
    "Agent, goal, skill requirement, attempt, strategy, and outcome.",
  supportedContextKinds: ["EVENT", "CONCEPTUAL", "PROCEDURAL"],
  roleDefinitions: [
    { id: "CHALLENGER", label: "Challenger", cardinality: "ONE", accepts: [] },
    { id: "CHALLENGE", label: "Challenge", cardinality: "ONE", accepts: [] },
    { id: "SKILL", label: "Skill", cardinality: "ONE", accepts: [] },
    { id: "ATTEMPT", label: "Attempt", cardinality: "MANY", accepts: [] },
    { id: "STRATEGY", label: "Strategy", cardinality: "OPTIONAL_ONE", accepts: [] },
    { id: "OUTCOME", label: "Outcome", cardinality: "ONE", accepts: [] },
  ],
  relationDefinitions: [
    {
      id: "USES",
      label: "Uses",
      fromRole: "ATTEMPT",
      toRole: "STRATEGY",
      directionality: "DIRECTED",
      temporalScope: "EVENT",
    },
    {
      id: "TARGETS",
      label: "Targets",
      fromRole: "ATTEMPT",
      toRole: "CHALLENGE",
      directionality: "DIRECTED",
      temporalScope: "EVENT",
    },
  ],
  stateDefinitions: [
    {
      id: "skill-level",
      subjectRole: "CHALLENGER",
      property: "skill-level",
      valueType: "NUMBER",
    },
    {
      id: "challenge-requirement",
      subjectRole: "CHALLENGE",
      property: "required-skill",
      valueType: "NUMBER",
    },
    {
      id: "attempt-status",
      subjectRole: "ATTEMPT",
      property: "status",
      valueType: "ENUM",
    },
  ],
  eventDefinitions: [
    { id: "TRY", participantRoles: ["CHALLENGER", "ATTEMPT"], preconditions: [], effects: [] },
    {
      id: "PRACTICE",
      participantRoles: ["CHALLENGER", "ATTEMPT"],
      preconditions: [],
      effects: [],
    },
    {
      id: "RECEIVE_FEEDBACK",
      participantRoles: ["CHALLENGER", "OUTCOME"],
      preconditions: [],
      effects: [],
    },
    { id: "RETRY", participantRoles: ["CHALLENGER", "ATTEMPT"], preconditions: [], effects: [] },
  ],
  affordanceDefinitions: [
    { id: "identify-claim", actorRole: "CHALLENGER", action: "IDENTIFY", enabledWhen: [] },
    { id: "select-claim", actorRole: "CHALLENGER", action: "SELECT", enabledWhen: [] },
    {
      id: "distinguish-claim",
      actorRole: "CHALLENGER",
      action: "DISTINGUISH",
      enabledWhen: [],
    },
    { id: "type-word", actorRole: "CHALLENGER", action: "TYPE", enabledWhen: [] },
    { id: "recall-word", actorRole: "CHALLENGER", action: "RECALL", enabledWhen: [] },
    { id: "observe-event", actorRole: "CHALLENGER", action: "OBSERVE", enabledWhen: [] },
    { id: "connect-state", actorRole: "CHALLENGER", action: "CONNECT", enabledWhen: [] },
  ],
  goalDefinitions: [
    {
      id: "COMPLETE_CHALLENGE",
      description: "The challenger satisfies the challenge goal predicate",
      successPredicate: pred("goal_satisfied", [roleArg("CHALLENGE")], true),
    },
  ],
  validationRules: [],
  provenance: FIXTURE_PROVENANCE,
  reviewStatus: "REVIEWED",
};
