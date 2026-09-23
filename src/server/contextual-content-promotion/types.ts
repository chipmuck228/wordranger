import type { ContextualContentBatchPromotionRecord } from "@/contextual-learning/candidate-v0/content";

export const PROMOTION_ACTOR_ID = "LOCAL_INTERNAL_PROMOTER";

export type PromotionFailureCode =
  | "PROMOTION_DISABLED"
  | "PROMOTION_WRITE_DISABLED"
  | "PROMOTION_RUNTIME_MISSING"
  | "PROMOTION_RUNTIME_INVALID"
  | "PROMOTION_RUNTIME_FORBIDDEN"
  | "PROMOTION_NOT_READY"
  | "PROMOTION_CONFLICT"
  | "PROMOTION_STALE"
  | "PROMOTION_INVALID"
  | "PROMOTION_NOT_FOUND";

export type PromotionSaveResult =
  | { ok: true; record: ContextualContentBatchPromotionRecord; idempotent: boolean }
  | { ok: false; code: PromotionFailureCode; message: string };
