import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  parseBatchPromotionRecord,
  type ContextualContentBatchPromotionRecord,
} from "@/contextual-learning/candidate-v0/content";
import { contextualPromotionRoot, safePromotionRecordPath } from "./promotion-artifact-path";
import type { ContextualContentBatchPromotionRepository } from "./promotion-repository";
import type { PromotionSaveResult } from "./types";

export class FileContextualContentBatchPromotionRepository
  implements ContextualContentBatchPromotionRepository
{
  readonly artifactRoot = contextualPromotionRoot();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePathFor = safePromotionRecordPath) {}

  async get(input: { sceneId: string; packId: string }): Promise<ContextualContentBatchPromotionRecord | null> {
    return this.enqueue(() => this.read(input.sceneId, input.packId));
  }

  async listByScene(sceneId: string): Promise<ContextualContentBatchPromotionRecord[]> {
    return this.enqueue(() => {
      const root = contextualPromotionRoot();
      let names: string[] = [];
      try {
        names = readdirSync(root);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return [];
        }
        throw error;
      }
      return names
        .filter((name) => name.startsWith(`${sceneId}__`) && name.endsWith(".json"))
        .flatMap((name) => {
          const packId = name.slice(`${sceneId}__`.length, -".json".length);
          const record = this.read(sceneId, packId);
          return record ? [record] : [];
        })
        .sort((left, right) => left.packId.localeCompare(right.packId));
    });
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

  private read(sceneId: string, packId: string): ContextualContentBatchPromotionRecord | null {
    const filePath = this.filePathFor({ sceneId, packId });
    if (!filePath) {
      return null;
    }
    try {
      return parseBatchPromotionRecord(JSON.parse(readFileSync(filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      return null;
    }
  }

  private saveSync(
    record: ContextualContentBatchPromotionRecord,
    expectedRevision: number,
  ): PromotionSaveResult {
    const parsed = parseBatchPromotionRecord(record);
    const filePath = parsed ? this.filePathFor(parsed) : null;
    if (!parsed || !filePath) {
      return { ok: false, code: "PROMOTION_INVALID", message: "Promotion record or path is invalid." };
    }
    const existing = this.read(parsed.sceneId, parsed.packId);
    if (!existing) {
      if (expectedRevision !== 0) {
        return { ok: false, code: "PROMOTION_STALE", message: "Promotion revision does not match the empty store." };
      }
      const created = { ...parsed, revision: 1 };
      this.write(filePath, created);
      return { ok: true, record: cloneFrozen(created), idempotent: false };
    }
    if (
      existing.packFingerprint === parsed.packFingerprint &&
      existing.lineageFingerprint === parsed.lineageFingerprint &&
      JSON.stringify(existing.targetApprovalBindings) === JSON.stringify(parsed.targetApprovalBindings)
    ) {
      return { ok: true, record: cloneFrozen(existing), idempotent: true };
    }
    if (existing.revision !== expectedRevision) {
      return { ok: false, code: "PROMOTION_CONFLICT", message: "Another promotion write happened first." };
    }
    const next = { ...parsed, revision: existing.revision + 1 };
    this.write(filePath, next);
    return { ok: true, record: cloneFrozen(next), idempotent: false };
  }

  private write(filePath: string, record: ContextualContentBatchPromotionRecord): void {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    renameSync(tempPath, filePath);
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
