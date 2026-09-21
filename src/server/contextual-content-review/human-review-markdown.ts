import type { HumanContentReviewRecord } from "./types";

export function renderHumanReviewMarkdown(input: {
  fingerprint: string;
  record: HumanContentReviewRecord | null;
}): string {
  const decision = input.record?.decision ?? "PENDING";
  const reviewer = input.record?.reviewer ?? "";
  const reviewedAt = input.record?.reviewedAt ?? "";
  const fingerprint = input.record?.contentFingerprint ?? input.fingerprint;
  const notes = input.record?.notes.length
    ? input.record.notes.map((note) => `- ${note}`).join("\n")
    : "";
  return `# Human review

Decision: ${decision}
Reviewer:${reviewer ? ` ${reviewer}` : ""}
Reviewed at:${reviewedAt ? ` ${reviewedAt}` : ""}
Reviewed fingerprint: ${fingerprint}

Notes:

${notes}

This file records a local internal human decision for one content fingerprint.
It does not promote the Candidate pack, change registry status, or publish content.
LOCAL_INTERNAL_REVIEWER is not a production identity.
`;
}
