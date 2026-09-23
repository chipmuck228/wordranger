import "server-only";

import { writeFileSync } from "node:fs";
import type { ContentReviewRepository } from "./content-review-repository";
import { fileContentReviewRepository } from "./file-content-review-repository";
import { isContextualContentReviewWriteEnabled } from "./gates";
import { renderHumanReviewMarkdown } from "./human-review-markdown";
import { currentContentFingerprint } from "./project-review-packet";
import { safeReviewMarkdownPath } from "./review-artifact-path";
import { CONTENT_REVIEW_TARGETS } from "./review-target-registry";
import type { HumanContentReviewDecision, SaveContentReviewResult } from "./types";

export async function saveContentReviewDecision(input: {
  fingerprint: string;
  revision: number;
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
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    return {
      ok: false,
      code: "CONTENT_REVIEW_INVALID",
      message: "Revision must be a non-negative integer from the current review snapshot.",
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
    return fingerprint === input.fingerprint ? [{ spec, fingerprint }] : [];
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
  const saved = await repository.saveIfRevision({
    expectedRevision: input.revision,
    record: {
      schemaVersion: "candidate-v0",
      reviewKey: spec.reviewKey,
      packId: spec.packId,
      target: spec.target,
      contentFingerprint: fingerprint,
      decision: input.decision,
      notes,
      reviewedAt: input.now ?? new Date().toISOString(),
      revision: input.revision + 1,
      reviewer: "LOCAL_INTERNAL_REVIEWER",
    },
  });
  if (saved.ok && input.syncMarkdown !== false) {
    const markdownPath = safeReviewMarkdownPath(spec.reviewKey);
    if (!markdownPath) {
      return {
        ok: false,
        code: "CONTENT_REVIEW_INVALID",
        message: "Review artifacts cannot be written outside the registered target directory.",
      };
    }
    writeFileSync(
      markdownPath,
      renderHumanReviewMarkdown({ fingerprint, record: saved.record }),
      "utf8",
    );
  }
  return saved;
}
