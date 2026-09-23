"use server";

import {
  isContextualContentPromotionEnabled,
  isContextualContentPromotionWriteEnabled,
} from "@/server/contextual-content-promotion/gates";
import { promoteContextualContentBatch } from "@/server/contextual-content-promotion/promote-contextual-content-batch";
import { isContextualContentReviewWriteEnabled } from "@/server/contextual-content-review/gates";
import { saveContentReviewDecision } from "@/server/contextual-content-review/save-review-decision";
import type { HumanContentReviewDecision, SaveContentReviewResult } from "@/server/contextual-content-review/types";

export async function submitContentReviewDecision(input: {
  fingerprint: string;
  revision: number;
  decision: Exclude<HumanContentReviewDecision, "PENDING">;
  notes: string[];
}): Promise<{
  ok: boolean;
  message?: string;
  code?: Extract<SaveContentReviewResult, { ok: false }>["code"];
}> {
  if (!isContextualContentReviewWriteEnabled()) {
    return {
      ok: false,
      code: "CONTENT_REVIEW_WRITE_DISABLED",
      message: "Review writes are disabled.",
    };
  }
  if (
    !input ||
    typeof input.fingerprint !== "string" ||
    !Number.isInteger(input.revision) ||
    input.revision < 0 ||
    (input.decision !== "APPROVED" &&
      input.decision !== "REVISE" &&
      input.decision !== "REJECTED") ||
    !Array.isArray(input.notes)
  ) {
    return { ok: false, code: "CONTENT_REVIEW_INVALID", message: "Invalid review payload." };
  }
  const result = await saveContentReviewDecision({
    fingerprint: input.fingerprint,
    revision: input.revision,
    decision: input.decision,
    notes: input.notes.map((note) => String(note)),
  });
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }
  return { ok: true };
}

export async function promoteReviewedBatch(input: {
  packId: string;
  expectedRevision: number;
}): Promise<{
  ok: boolean;
  message?: string;
  code?: string;
}> {
  if (!isContextualContentPromotionEnabled()) {
    return { ok: false, code: "PROMOTION_DISABLED", message: "Promotion is disabled." };
  }
  if (!isContextualContentPromotionWriteEnabled()) {
    return { ok: false, code: "PROMOTION_WRITE_DISABLED", message: "Promotion writes are disabled." };
  }
  if (
    !input ||
    typeof input.packId !== "string" ||
    !Number.isInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    return { ok: false, code: "PROMOTION_INVALID", message: "Invalid promotion payload." };
  }
  const result = await promoteContextualContentBatch({
    packId: input.packId,
    expectedRevision: input.expectedRevision,
  });
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }
  return { ok: true };
}
