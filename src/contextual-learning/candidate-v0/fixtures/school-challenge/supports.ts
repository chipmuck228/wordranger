import type { SupportBlock } from "../../domain/types";
import { FIXTURE_PROVENANCE, textSupport } from "../shared";
import { SCHOOL_SENSE } from "./knowledge";

export const SCHOOL_SUPPORTS: SupportBlock[] = [
  textSupport(
    "school-support-function",
    "Look at whether the goal predicate was satisfied, not only whether someone tried.",
    "LOW",
    [SCHOOL_SENSE.try.senseId, SCHOOL_SENSE.success.senseId],
  ),
  {
    id: "school-support-contrast",
    type: "CONTRAST",
    appliesToModes: ["BUILD", "STRENGTHEN"],
    targetSenseIds: [SCHOOL_SENSE.try.senseId, SCHOOL_SENSE.success.senseId],
    content: {
      kind: "CONTRAST",
      contrastSetId: "contrast-try-success",
      focus: "Effort without a satisfied goal is try, not success.",
    },
    revealCost: "MEDIUM",
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  {
    id: "school-support-partial",
    type: "HINT",
    appliesToModes: ["STRENGTHEN"],
    targetSenseIds: [SCHOOL_SENSE.try.senseId],
    content: { kind: "PARTIAL_LEXICAL_CUE", pattern: "t__" },
    revealCost: "MEDIUM",
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  textSupport(
    "school-support-answer",
    "The English word is try.",
    "ANSWER_REVEALING",
    [SCHOOL_SENSE.try.senseId],
  ),
];
