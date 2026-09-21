import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  parseReleaseManifest,
  type ContextualContentReleaseManifest,
} from "@/contextual-learning/candidate-v0/release";
import type { ContextualContentReleaseRepository } from "./release-repository";
import type { ReleaseSaveResult } from "./types";

export class InMemoryContextualContentReleaseRepository
  implements ContextualContentReleaseRepository
{
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly rows: Map<string, ContextualContentReleaseManifest> = new Map(),
  ) {}

  async create(input: {
    record: ContextualContentReleaseManifest;
  }): Promise<ReleaseSaveResult> {
    return this.enqueue(() => this.createSync(input.record));
  }

  async get(releaseId: string): Promise<ContextualContentReleaseManifest | null> {
    return this.enqueue(() => this.read(releaseId));
  }

  async list(): Promise<ContextualContentReleaseManifest[]> {
    return this.enqueue(() => [...this.rows.keys()].sort().flatMap((id) => {
      const record = this.read(id);
      return record ? [record] : [];
    }));
  }

  async saveIfRevision(input: {
    record: ContextualContentReleaseManifest;
    expectedRevision: number;
  }): Promise<ReleaseSaveResult> {
    return this.enqueue(() => this.saveSync(input.record, input.expectedRevision));
  }

  async discard(input: {
    releaseId: string;
    expectedRevision: number;
  }): Promise<ReleaseSaveResult> {
    return this.enqueue(() => {
      const existing = this.read(input.releaseId);
      if (!existing) {
        return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
      }
      if (existing.revision !== input.expectedRevision) {
        return { ok: false, code: "RELEASE_CONFLICT", message: "Another release write happened first." };
      }
      if (existing.status !== "DRAFT" && existing.status !== "PREFLIGHT_VALIDATED") {
        return { ok: false, code: "RELEASE_INVALID", message: "Only local drafts can be discarded." };
      }
      this.rows.delete(input.releaseId);
      return { ok: true, record: existing, idempotent: false };
    });
  }

  reset(): void {
    this.rows.clear();
  }

  replaceRaw(record: ContextualContentReleaseManifest): void {
    this.rows.set(record.releaseId, record);
  }

  private createSync(record: ContextualContentReleaseManifest): ReleaseSaveResult {
    const parsed = parseReleaseManifest(record);
    if (!parsed || parsed.revision !== 0 || parsed.status !== "DRAFT") {
      return { ok: false, code: "RELEASE_INVALID", message: "New releases must be DRAFT at revision 0." };
    }
    const existing = this.read(parsed.releaseId);
    if (existing) {
      if (
        existing.releaseFingerprint === parsed.releaseFingerprint &&
        existing.status === "DRAFT"
      ) {
        return { ok: true, record: existing, idempotent: true };
      }
      return { ok: false, code: "RELEASE_CONFLICT", message: "Release id already exists." };
    }
    const stored = cloneFrozen(parsed);
    this.rows.set(stored.releaseId, stored);
    return { ok: true, record: cloneFrozen(stored), idempotent: false };
  }

  private saveSync(
    record: ContextualContentReleaseManifest,
    expectedRevision: number,
  ): ReleaseSaveResult {
    const parsed = parseReleaseManifest(record);
    if (!parsed) {
      return { ok: false, code: "RELEASE_INVALID", message: "Malformed release schema." };
    }
    const existing = this.read(parsed.releaseId);
    if (!existing) {
      return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
    }
    if (
      existing.releaseFingerprint === parsed.releaseFingerprint &&
      existing.status === parsed.status &&
      existing.revision === parsed.revision &&
      existing.validatedAt === parsed.validatedAt
    ) {
      return { ok: true, record: existing, idempotent: true };
    }
    if (existing.revision !== expectedRevision) {
      return { ok: false, code: "RELEASE_CONFLICT", message: "Another release write happened first." };
    }
    const stored = cloneFrozen({
      ...parsed,
      revision: expectedRevision + 1,
    });
    this.rows.set(stored.releaseId, stored);
    return { ok: true, record: cloneFrozen(stored), idempotent: false };
  }

  private read(releaseId: string): ContextualContentReleaseManifest | null {
    const stored = this.rows.get(releaseId);
    if (!stored) {
      return null;
    }
    const parsed = parseReleaseManifest(stored);
    return parsed ? cloneFrozen(parsed) : null;
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
