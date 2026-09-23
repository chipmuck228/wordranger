import type { ContextualContentBatchPromotionRecord } from "@/contextual-learning/candidate-v0/content";
import type { PromotionSaveResult } from "./types";

export interface ContextualContentBatchPromotionRepository {
  get(input: { sceneId: string; packId: string }): Promise<ContextualContentBatchPromotionRecord | null>;
  listByScene(sceneId: string): Promise<ContextualContentBatchPromotionRecord[]>;
  createIfAbsent(record: ContextualContentBatchPromotionRecord): Promise<PromotionSaveResult>;
  promoteIfRevision(input: {
    record: ContextualContentBatchPromotionRecord;
    expectedRevision: number;
  }): Promise<PromotionSaveResult>;
}
