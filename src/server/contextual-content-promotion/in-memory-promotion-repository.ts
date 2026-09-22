import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  parseBatchPromotionRecord,
  type ContextualContentBatchPromotionRecord,
} from "@/contextual-learning/candidate-v0/content";
import type { ContextualContentBatchPromotionRepository } from "./promotion-repository";
import type { PromotionSaveResult } from "./types";

function keyFor(sceneId: string, packId: string): string {
  return `${sceneId}::${packId}`;
}

export class InMemoryContextualContentBatchPromotionRepository
  implements ContextualContentBatchPromotionRepository
{
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly rows = new Map<string, ContextualContentBatchPromotionRecord>()) {}

  async get(input: { sceneId: string; packId: string }): Promise<ContextualContentBatchPromotionRecord | null> {
    return this.enqueue(() => this.read(input.sceneId, input.packId));
  }

  async listByScene(sceneId: string): Promise<ContextualContentBatchPromotionRecord[]> {
    return this.enqueue(() =>
      [...this.rows.values()]
        .map((item) => parseBatchPromotionRecord(item))
        .filter((item): item is ContextualContentBatchPromotionRecord => Boolean(item && item.sceneId === sceneId))
        .map((item) => cloneFrozen(item))
        .sort((left, right) => left.packId.localeCompare(right.packId)),
    );
  }

  async createIfAbsent(record: ContextualContentBatchPromotionRecord): Promise<PromotionSaveResult> {
    return this.promoteIfRevision({ record, expectedRevision: 0 });
  }

  async promoteIfRevision(input: {
    record: ContextualContentBatchPromotionRecord;
    expectedRevision: number;
  }): Promise<PromotionSaveResult> {
    return this.enqueue(() => this.saveSync(input.record, input.expectedRevision));
  }

  reset(): void {
    this.rows.clear();
  }

  private read(sceneId: string, packId: string): ContextualContentBatchPromotionRecord | null {
    const parsed = parseBatchPromotionRecord(this.rows.get(keyFor(sceneId, packId)));
    return parsed ? cloneFrozen(parsed) : null;
  }

  private saveSync(
    record: ContextualContentBatchPromotionRecord,
    expectedRevision: number,
  ): PromotionSaveResult {
    const parsed = parseBatchPromotionRecord(record);
    if (!parsed) {
      return { ok: false, code: "PROMOTION_INVALID", message: "Promotion record is malformed." };
    }
    const existing = this.read(parsed.sceneId, parsed.packId);
    if (!existing) {
      if (expectedRevision !== 0) {
        return { ok: false, code: "PROMOTION_STALE", message: "Promotion revision does not match the empty store." };
      }
      const created = { ...parsed, revision: 1 };
      this.rows.set(keyFor(created.sceneId, created.packId), created);
      return { ok: true, record: cloneFrozen(created), idempotent: false };
    }
    if (
      existing.packFingerprint === parsed.packFingerprint &&
      existing.lineageFingerprint === parsed.lineageFingerprint &&
      JSON.stringify(existing.targetApprovalBindings) === JSON.stringify(parsed.targetApprovalBindings)
    ) {
      return { ok: true, record: existing, idempotent: true };
    }
    if (existing.revision !== expectedRevision) {
      return { ok: false, code: "PROMOTION_CONFLICT", message: "Another promotion write happened first." };
    }
    const next = { ...parsed, revision: existing.revision + 1 };
    this.rows.set(keyFor(next.sceneId, next.packId), next);
    return { ok: true, record: cloneFrozen(next), idempotent: false };
  }

  private enqueue<T>(work: () => T): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
