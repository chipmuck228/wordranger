import type {
  ContextFrame,
  ExperienceStepSpec,
  LearningExperiencePlan,
} from "../../domain/types";
import {
  FIXTURE_PROVENANCE,
  MINIMAL_SUPPORT,
  completeAll,
  nextOrEnd,
  pred,
  roleArg,
  strengthenLadder,
} from "../shared";
import { borrowPrefixForFrame } from "./contexts";
import { BORROW_SENSE } from "./knowledge";
import { BORROW_SKELETON_ID } from "./skeleton";

function borrowTargets(includeShare: boolean) {
  if (includeShare) {
    return [
      {
        id: "target-share",
        sense: BORROW_SENSE.share,
        focus: "DISCRIMINATION" as const,
        requiredRelationIds: ["OWNS"],
      },
    ];
  }
  return [
    {
      id: "target-borrow",
      sense: BORROW_SENSE.borrow,
      focus: "RELATION_USE" as const,
      requiredRelationIds: ["TEMPORARILY_POSSESSES"],
    },
    {
      id: "target-lend",
      sense: BORROW_SENSE.lend,
      focus: "RELATION_USE" as const,
      requiredRelationIds: ["OWNS"],
    },
  ];
}

function borrowChoiceSteps(
  prefix: string,
  mode: "BUILD" | "STRENGTHEN",
  includeShare: boolean,
): ExperienceStepSpec[] {
  const strengthenPolicy = {
    initialSupportBlockIds: [],
    ladder: strengthenLadder({
      functionCue: "borrow-support-function",
      contrast: "borrow-support-contrast",
      partial: "borrow-support-partial",
      answer: "borrow-support-answer",
    }),
  };

  const requesterView: ExperienceStepSpec = {
    id: `${prefix}-${mode.toLowerCase()}-requester-view`,
    purpose: "DISCRIMINATE",
    targetIds: ["target-borrow"],
    semanticAction: "SELECT",
    promptIntent: {
      instructionKey:
        "The item moves from owner to requester. From the requester's view, which relation holds?",
      semanticQuestion: pred("expressed_from_observer", [roleArg("REQUESTER")]),
    },
    expectedResponse: {
      kind: "RELATION_CHOICE",
      allowedRelationIds: ["rel-borrow", "rel-lend", "rel-give"],
    },
    supportPolicy: mode === "BUILD" ? MINIMAL_SUPPORT : strengthenPolicy,
    requiredCapabilities: ["frozen-choice:SELECT"],
    transition: nextOrEnd(false),
  };

  const ownerView: ExperienceStepSpec = {
    id: `${prefix}-${mode.toLowerCase()}-owner-view`,
    purpose: "DISCRIMINATE",
    targetIds: ["target-lend"],
    semanticAction: "DISTINGUISH",
    promptIntent: {
      instructionKey:
        "The same transfer, owner as subject. Which relation holds?",
      semanticQuestion: pred("expressed_from_observer", [roleArg("OWNER")]),
    },
    expectedResponse: {
      kind: "RELATION_CHOICE",
      allowedRelationIds: ["rel-borrow", "rel-lend", "rel-give"],
    },
    supportPolicy: mode === "BUILD" ? MINIMAL_SUPPORT : strengthenPolicy,
    requiredCapabilities: ["frozen-choice:DISTINGUISH"],
    transition: nextOrEnd(false),
  };

  const recall: ExperienceStepSpec = {
    id: `${prefix}-${mode.toLowerCase()}-recall`,
    purpose: "RECALL",
    targetIds: includeShare ? ["target-share"] : ["target-borrow"],
    semanticAction: "TYPE",
    promptIntent: {
      instructionKey: includeShare
        ? "Name the word for joint use that does not change ownership."
        : "Name the verb for receiving temporary use without taking ownership.",
      semanticQuestion: pred("name_temporary_access", [roleArg("REQUESTER")]),
      mustNotRevealTargetForm: true,
    },
    expectedResponse: {
      kind: "LEXICAL_FORM",
      sense: includeShare ? BORROW_SENSE.share : BORROW_SENSE.borrow,
    },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: ["frozen-text-input:TYPE"],
    transition: nextOrEnd(true),
  };

  if (includeShare) {
    return [
      {
        ...requesterView,
        targetIds: ["target-share"],
        expectedResponse: {
          kind: "RELATION_CHOICE",
          allowedRelationIds: ["rel-share", "rel-give", "rel-borrow"],
        },
      },
      recall,
    ];
  }

  return [requesterView, ownerView, recall];
}

export function createBorrowBuildPlan(
  frame: ContextFrame,
): LearningExperiencePlan {
  const prefix = borrowPrefixForFrame(frame.id);
  const includeShare = prefix === "share";
  const steps = borrowChoiceSteps(prefix, "BUILD", includeShare);
  return {
    id: `borrow-build-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "BUILD",
    sourceLearningNeedRef: "need-borrow-lend",
    targets: borrowTargets(includeShare),
    skeletonId: BORROW_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "REQUESTER_CAN_USE_ITEM_WITHOUT_CHANGING_OWNERSHIP",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function createBorrowStrengthenPlan(
  frame: ContextFrame,
): LearningExperiencePlan {
  const prefix = borrowPrefixForFrame(frame.id);
  const includeShare = prefix === "share";
  const steps = borrowChoiceSteps(prefix, "STRENGTHEN", includeShare);
  return {
    id: `borrow-strengthen-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "STRENGTHEN",
    sourceLearningNeedRef: "need-borrow-lend",
    targets: borrowTargets(includeShare),
    skeletonId: BORROW_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "REQUESTER_CAN_USE_ITEM_WITHOUT_CHANGING_OWNERSHIP",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}

/** Documented gap: ORDER has no frozen PublicLearningTask contract. */
export function createUnsupportedOrderStep(): ExperienceStepSpec {
  return {
    id: "borrow-order-observe-gap",
    purpose: "OBSERVE",
    targetIds: ["target-borrow"],
    semanticAction: "ORDER",
    promptIntent: {
      instructionKey: "Order the possession states of the transfer.",
      semanticQuestion: pred("order_states", []),
    },
    expectedResponse: {
      kind: "ORDERED_ENTITY_REFS",
      allowedSequences: [
        ["class-owner", "class-holder", "class-owner"],
      ],
    },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: [],
    transition: nextOrEnd(true),
  };
}
