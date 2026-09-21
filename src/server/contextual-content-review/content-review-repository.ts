import type { HumanContentReviewRecord, SaveContentReviewResult } from "./types";

export interface ContentReviewRepository {
  get(reviewKey: string): Promise<HumanContentReviewRecord | null>;
  saveIfRevision(input: {
    record: HumanContentReviewRecord;
    expectedRevision: number;
  }): Promise<SaveContentReviewResult>;
  commit(input: {
    reviewKey: string;
    next(existing: HumanContentReviewRecord | null): SaveContentReviewResult | HumanContentReviewRecord;
  }): Promise<SaveContentReviewResult>;
}
