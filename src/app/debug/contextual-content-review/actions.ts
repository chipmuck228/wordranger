"use server";

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
