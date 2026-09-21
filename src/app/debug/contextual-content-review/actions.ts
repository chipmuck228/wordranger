"use server";

import { isContextualContentReviewWriteEnabled } from "@/server/contextual-content-review/gates";
import { saveContentReviewDecision } from "@/server/contextual-content-review/save-review-decision";
import type { HumanContentReviewDecision } from "@/server/contextual-content-review/types";

export async function submitContentReviewDecision(input: {
  expectedFingerprint: string;
  decision: Exclude<HumanContentReviewDecision, "PENDING">;
  notes: string[];
}): Promise<{ ok: boolean; message?: string }> {
  if (!isContextualContentReviewWriteEnabled()) {
    return {
      ok: false,
      message: "Review writes are disabled.",
    };
  }
  if (
    !input ||
    typeof input.expectedFingerprint !== "string" ||
    (input.decision !== "APPROVED" &&
      input.decision !== "REVISE" &&
      input.decision !== "REJECTED") ||
    !Array.isArray(input.notes)
  ) {
    return { ok: false, message: "Invalid review payload." };
  }
  const result = await saveContentReviewDecision({
    expectedFingerprint: input.expectedFingerprint,
    decision: input.decision,
    notes: input.notes.map((note) => String(note)),
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true };
}
