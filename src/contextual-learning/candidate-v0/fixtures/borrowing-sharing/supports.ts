import type { SupportBlock } from "../../domain/types";
import { FIXTURE_PROVENANCE, textSupport } from "../shared";
import { BORROW_SENSE } from "./knowledge";

export const BORROW_SUPPORTS: SupportBlock[] = [
  textSupport(
    "borrow-support-function",
    "Name the verb from the subject who receives temporary use.",
    "LOW",
    [BORROW_SENSE.borrow.senseId],
  ),
  {
    id: "borrow-support-contrast",
    type: "CONTRAST",
    appliesToModes: ["BUILD", "STRENGTHEN"],
    targetSenseIds: [BORROW_SENSE.borrow.senseId, BORROW_SENSE.lend.senseId],
    content: {
      kind: "CONTRAST",
      contrastSetId: "contrast-borrow-lend",
      focus: "Same transfer: requester borrows, owner lends.",
    },
    revealCost: "MEDIUM",
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  {
    id: "borrow-support-partial",
    type: "HINT",
    appliesToModes: ["STRENGTHEN"],
    targetSenseIds: [BORROW_SENSE.borrow.senseId],
    content: { kind: "PARTIAL_LEXICAL_CUE", pattern: "b____w" },
    revealCost: "MEDIUM",
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  textSupport(
    "borrow-support-answer",
    "The English word is borrow.",
    "ANSWER_REVEALING",
    [BORROW_SENSE.borrow.senseId],
  ),
];
