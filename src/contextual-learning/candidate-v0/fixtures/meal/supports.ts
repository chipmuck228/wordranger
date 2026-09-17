import type { SupportBlock } from "../../domain/types";
import { FIXTURE_PROVENANCE, textSupport } from "../shared";
import { MEAL_SENSE } from "./knowledge";

export const MEAL_SUPPORTS: SupportBlock[] = [
  textSupport(
    "meal-support-function",
    "Choose the tool that can lift liquid food.",
    "LOW",
    [MEAL_SENSE.spoon.senseId],
  ),
  {
    id: "meal-support-contrast",
    type: "CONTRAST",
    appliesToModes: ["BUILD", "STRENGTHEN"],
    targetSenseIds: [MEAL_SENSE.spoon.senseId, MEAL_SENSE.fork.senseId],
    content: {
      kind: "CONTRAST",
      contrastSetId: "contrast-spoon-fork",
      focus: "A fork is better for piercing pieces, not for soup.",
    },
    revealCost: "MEDIUM",
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  {
    id: "meal-support-partial",
    type: "HINT",
    appliesToModes: ["STRENGTHEN", "RETRIEVE"],
    targetSenseIds: [MEAL_SENSE.spoon.senseId],
    content: { kind: "PARTIAL_LEXICAL_CUE", pattern: "sp__n" },
    revealCost: "MEDIUM",
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  textSupport(
    "meal-support-answer",
    "The English word is spoon.",
    "ANSWER_REVEALING",
    [MEAL_SENSE.spoon.senseId],
  ),
];
