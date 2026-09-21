import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ContentReviewRepository } from "./content-review-repository";
import type { HumanContentReviewRecord, SaveContentReviewResult } from "./types";

export function contentReviewRecordPath(reviewKey: string): string {
  return path.join(
    process.cwd(),
    "docs/contextual-content-reviews",
    reviewKey,
    "human-review.record.json",
  );
}

export class FileContentReviewRepository implements ContentReviewRepository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePathFor = contentReviewRecordPath) {}

  async get(reviewKey: string): Promise<HumanContentReviewRecord | null> {
    return this.enqueue(() => this.read(reviewKey));
  }

  async saveIfRevision(input: {
    record: HumanContentReviewRecord;
    expectedRevision: number;
  }): Promise<SaveContentReviewResult> {
    return this.commit({
      reviewKey: input.record.reviewKey,
      next: (existing) => {
        if (
          existing &&
          existing.contentFingerprint === input.record.contentFingerprint &&
          existing.decision === input.record.decision &&
          JSON.stringify(existing.notes) === JSON.stringify(input.record.notes)
        ) {
          return { ok: true, record: existing, idempotent: true };
        }
        const currentRevision = existing?.revision ?? 0;
        if (currentRevision !== input.expectedRevision) {
          return {
            ok: false,
            code: "CONTENT_REVIEW_CONFLICT",
            message: "Another review decision was saved first.",
          };
        }
        return {
          ...input.record,
          revision: input.expectedRevision + 1,
        };
      },
    });
  }

  async commit(input: {
    reviewKey: string;
    next(
      existing: HumanContentReviewRecord | null,
    ): SaveContentReviewResult | HumanContentReviewRecord;
  }): Promise<SaveContentReviewResult> {
    return this.enqueue(() => {
      const existing = this.read(input.reviewKey);
      const decided = input.next(existing);
      if ("ok" in decided) {
        return decided;
      }
      this.write(decided);
      return { ok: true, record: decided, idempotent: false };
    });
  }

  private enqueue<T>(work: () => T): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private read(reviewKey: string): HumanContentReviewRecord | null {
    try {
      const parsed = JSON.parse(
        readFileSync(this.filePathFor(reviewKey), "utf8"),
      ) as HumanContentReviewRecord;
      if (!parsed?.reviewKey || !parsed.contentFingerprint || !parsed.decision) {
        return null;
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private write(record: HumanContentReviewRecord): void {
    const filePath = this.filePathFor(record.reviewKey);
    mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    renameSync(tempPath, filePath);
  }
}

export const fileContentReviewRepository = new FileContentReviewRepository();
