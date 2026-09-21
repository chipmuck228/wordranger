import "server-only";

import { writeFileSync } from "node:fs";
import path from "node:path";
import type { ContentReviewRepository } from "./content-review-repository";
import { fileContentReviewRepository } from "./file-content-review-repository";
import { isContextualContentReviewWriteEnabled } from "./gates";
import { renderHumanReviewMarkdown } from "./human-review-markdown";
import { currentContentFingerprint } from "./project-review-packet";
import { CONTENT_REVIEW_TARGETS } from "./review-target-registry";
import type { HumanContentReviewDecision, SaveContentReviewResult } from "./types";

export async function saveContentReviewDecision(input: {
  expectedFingerprint: string;
  decision: Exclude<HumanContentReviewDecision, "PENDING">;
  notes: string[];
  now?: string;
  env?: Record<string, string | undefined>;
  repository?: ContentReviewRepository;
  syncMarkdown?: boolean;
}): Promise<SaveContentReviewResult> {
  if (!isContextualContentReviewWriteEnabled(input.env)) {
    return {
      ok: false,
      code: "CONTENT_REVIEW_WRITE_DISABLED",
      message:
        "Review writes are disabled. Set CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED=1 on local development only.",
    };
  }
  if (
    (input.decision === "REVISE" || input.decision === "REJECTED") &&
    input.notes.filter((note) => note.trim()).length === 0
  ) {
    return {
      ok: false,
      code: "CONTENT_REVIEW_NOTES_REQUIRED",
      message: "REVISE and REJECTED require at least one note.",
    };
  }
  const matches = CONTENT_REVIEW_TARGETS.flatMap((spec) => {
    const fingerprint = currentContentFingerprint(spec);
    return fingerprint === input.expectedFingerprint ? [{ spec, fingerprint }] : [];
  });
  if (matches.length !== 1) {
    return {
      ok: false,
      code: "CONTENT_REVIEW_STALE",
      message: "The submitted fingerprint does not match current review content.",
    };
  }
  const { spec, fingerprint } = matches[0]!;
  const repository = input.repository ?? fileContentReviewRepository;
  const notes = input.notes.map((note) => note.trim()).filter(Boolean);
  const saved = await repository.commit({
    reviewKey: spec.reviewKey,
    next: (existing) => {
      if (
        existing &&
        existing.contentFingerprint === fingerprint &&
        existing.decision === input.decision &&
        JSON.stringify(existing.notes) === JSON.stringify(notes)
      ) {
        return { ok: true, record: existing, idempotent: true };
      }
      return {
        schemaVersion: "candidate-v0" as const,
        reviewKey: spec.reviewKey,
        packId: spec.packId,
        target: spec.target,
        contentFingerprint: fingerprint,
        decision: input.decision,
        notes,
        reviewedAt: input.now ?? new Date().toISOString(),
        revision: (existing?.revision ?? 0) + 1,
        reviewer: "LOCAL_INTERNAL_REVIEWER" as const,
      };
    },
  });
  if (saved.ok && input.syncMarkdown !== false) {
    const markdownPath = path.join(
      process.cwd(),
      "docs/contextual-content-reviews",
      spec.reviewKey,
      "HUMAN_REVIEW.md",
    );
    writeFileSync(
      markdownPath,
      renderHumanReviewMarkdown({ fingerprint, record: saved.record }),
      "utf8",
    );
  }
  return saved;
}
