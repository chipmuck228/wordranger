import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  fingerprintsForManifest,
  parseActiveReleasePointer,
  parseReleaseManifest,
  type ContextualContentActiveReleasePointer,
  type ContextualContentReleaseManifest,
} from "@/contextual-learning/candidate-v0/release";
import type {
  ActiveReleaseLoadResult,
  ContextualContentReleaseRepository,
  PublishAtomicResult,
  RollbackPointerResult,
} from "./release-repository";
import type { ReleaseSaveResult } from "./types";

export class InMemoryContextualContentReleaseRepository
  implements ContextualContentReleaseRepository
{
  private queue: Promise<unknown> = Promise.resolve();
  private failNextPublish: "none" | "after-status" = "none";

  constructor(
    private readonly rows: Map<string, ContextualContentReleaseManifest> = new Map(),
    private readonly pointers: Map<string, ContextualContentActiveReleasePointer> = new Map(),
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
    return this.enqueue(() =>
      [...this.rows.keys()].sort().flatMap((id) => {
        const record = this.read(id);
        return record ? [record] : [];
      }),
    );
  }

  async listByScene(sceneId: string): Promise<ContextualContentReleaseManifest[]> {
    return this.enqueue(() =>
      [...this.rows.keys()].sort().flatMap((id) => {
        const record = this.read(id);
        return record && record.sceneId === sceneId ? [record] : [];
      }),
    );
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

  async getActivePointer(
    sceneId: string,
  ): Promise<ContextualContentActiveReleasePointer | null> {
    return this.enqueue(() => this.readPointer(sceneId));
  }

  async loadActiveRelease(sceneId: string): Promise<ActiveReleaseLoadResult> {
    return this.enqueue(() => this.loadActiveSync(sceneId));
  }

  async publishAtomic(input: {
    record: ContextualContentReleaseManifest;
    expectedRevision: number;
    pointer: ContextualContentActiveReleasePointer;
    expectedPointerRevision: number | null;
    superseded?: {
      record: ContextualContentReleaseManifest;
      expectedRevision: number;
    };
  }): Promise<PublishAtomicResult> {
    return this.enqueue(() => this.publishSync(input));
  }

  async rollbackPointer(input: {
    sceneId: string;
    expectedPointerRevision: number;
    pointer: ContextualContentActiveReleasePointer;
  }): Promise<RollbackPointerResult> {
    return this.enqueue(() => this.rollbackSync(input));
  }

  reset(): void {
    this.rows.clear();
    this.pointers.clear();
    this.failNextPublish = "none";
  }

  replaceRaw(record: ContextualContentReleaseManifest): void {
    this.rows.set(record.releaseId, record);
  }

  replacePointerRaw(pointer: ContextualContentActiveReleasePointer): void {
    this.pointers.set(pointer.sceneId, pointer);
  }

  failNextPublishAfterStatus(): void {
    this.failNextPublish = "after-status";
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
      existing.validatedAt === parsed.validatedAt &&
      existing.publishedAt === parsed.publishedAt &&
      existing.supersededAt === parsed.supersededAt
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

  private publishSync(input: {
    record: ContextualContentReleaseManifest;
    expectedRevision: number;
    pointer: ContextualContentActiveReleasePointer;
    expectedPointerRevision: number | null;
    superseded?: {
      record: ContextualContentReleaseManifest;
      expectedRevision: number;
    };
  }): PublishAtomicResult {
    const parsed = parseReleaseManifest(input.record);
    const pointer = parseActiveReleasePointer(input.pointer);
    if (!parsed || !pointer || parsed.status !== "PUBLISHED") {
      return { ok: false, code: "RELEASE_INVALID", message: "Published snapshot or pointer is invalid." };
    }
    const existing = this.read(parsed.releaseId);
    if (!existing) {
      return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
    }
    const currentPointer = this.readPointer(pointer.sceneId);
    if (
      existing.status === "PUBLISHED" &&
      currentPointer?.releaseId === parsed.releaseId &&
      currentPointer.releaseFingerprint === parsed.releaseFingerprint
    ) {
      return {
        ok: true,
        record: existing,
        pointer: currentPointer,
        superseded: null,
        idempotent: true,
      };
    }
    if (existing.revision !== input.expectedRevision) {
      return { ok: false, code: "RELEASE_CONFLICT", message: "Another release write happened first." };
    }
    if (existing.status !== "PREFLIGHT_VALIDATED") {
      return { ok: false, code: "RELEASE_INVALID", message: "Only PREFLIGHT_VALIDATED releases can be published." };
    }
    if ((currentPointer?.revision ?? null) !== input.expectedPointerRevision) {
      return { ok: false, code: "RELEASE_CONFLICT", message: "Active pointer changed before publish." };
    }

    const nextRelease = cloneFrozen({
      ...parsed,
      revision: input.expectedRevision + 1,
    });
    let nextSuperseded: ContextualContentReleaseManifest | null = null;
    if (input.superseded) {
      const superseded = parseReleaseManifest(input.superseded.record);
      const currentSuperseded = this.read(input.superseded.record.releaseId);
      if (
        !superseded ||
        !currentSuperseded ||
        currentSuperseded.revision !== input.superseded.expectedRevision
      ) {
        return { ok: false, code: "RELEASE_CONFLICT", message: "Previous active release changed before publish." };
      }
      nextSuperseded = cloneFrozen({
        ...superseded,
        revision: input.superseded.expectedRevision + 1,
      });
    }

    const nextPointer = cloneFrozen({
      ...pointer,
      revision:
        input.expectedPointerRevision === null ? 0 : input.expectedPointerRevision + 1,
    });

    if (this.failNextPublish === "after-status") {
      this.failNextPublish = "none";
      return { ok: false, code: "RELEASE_RUNTIME_INVALID", message: "Publish aborted before pointer commit." };
    }

    this.rows.set(nextRelease.releaseId, nextRelease);
    if (nextSuperseded) {
      this.rows.set(nextSuperseded.releaseId, nextSuperseded);
    }
    this.pointers.set(nextPointer.sceneId, nextPointer);
    return {
      ok: true,
      record: cloneFrozen(nextRelease),
      pointer: cloneFrozen(nextPointer),
      superseded: nextSuperseded ? cloneFrozen(nextSuperseded) : null,
      idempotent: false,
    };
  }

  private rollbackSync(input: {
    sceneId: string;
    expectedPointerRevision: number;
    pointer: ContextualContentActiveReleasePointer;
  }): RollbackPointerResult {
    const pointer = parseActiveReleasePointer(input.pointer);
    if (!pointer || pointer.sceneId !== input.sceneId) {
      return { ok: false, code: "RELEASE_INVALID", message: "Rollback pointer is invalid." };
    }
    const current = this.readPointer(input.sceneId);
    const target = this.read(pointer.releaseId);
    if (!target) {
      return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
    }
    if (
      current &&
      current.releaseId === pointer.releaseId &&
      current.releaseFingerprint === pointer.releaseFingerprint
    ) {
      return { ok: true, pointer: current, target, idempotent: true };
    }
    if (!current || current.revision !== input.expectedPointerRevision) {
      return { ok: false, code: "RELEASE_CONFLICT", message: "Active pointer changed before rollback." };
    }
    if (target.status !== "PUBLISHED" && target.status !== "SUPERSEDED") {
      return { ok: false, code: "RELEASE_NOT_PUBLISHED", message: "Only previously published releases can become active." };
    }
    if (target.publishedAt == null) {
      return { ok: false, code: "RELEASE_NOT_PUBLISHED", message: "Only previously published releases can become active." };
    }
    const restored =
      target.status === "SUPERSEDED"
        ? cloneFrozen({
            ...target,
            status: "PUBLISHED" as const,
            revision: target.revision + 1,
          })
        : target;
    const nextPointer = cloneFrozen({
      ...pointer,
      revision: input.expectedPointerRevision + 1,
    });
    this.rows.set(restored.releaseId, restored);
    this.pointers.set(input.sceneId, nextPointer);
    return { ok: true, pointer: cloneFrozen(nextPointer), target: cloneFrozen(restored), idempotent: false };
  }

  private loadActiveSync(sceneId: string): ActiveReleaseLoadResult {
    const pointer = this.readPointer(sceneId);
    if (!pointer) {
      return { ok: false, code: "RELEASE_POINTER_INVALID", message: "No active release pointer." };
    }
    const release = this.read(pointer.releaseId);
    if (!release) {
      return { ok: false, code: "RELEASE_NOT_FOUND", message: "Active release is missing." };
    }
    if (release.status !== "PUBLISHED") {
      return { ok: false, code: "RELEASE_POINTER_MISMATCH", message: "Active pointer is not bound to a published release." };
    }
    if (release.sceneId !== sceneId) {
      return { ok: false, code: "RELEASE_POINTER_MISMATCH", message: "Active pointer scene does not match." };
    }
    if (pointer.releaseFingerprint !== release.releaseFingerprint) {
      return { ok: false, code: "RELEASE_POINTER_MISMATCH", message: "Active pointer fingerprint does not match the release." };
    }
    const computed = fingerprintsForManifest(release);
    if (computed.releaseFingerprint !== release.releaseFingerprint) {
      return { ok: false, code: "RELEASE_POINTER_MISMATCH", message: "Active release fingerprint cannot be recomputed." };
    }
    return { ok: true, pointer, release };
  }

  private read(releaseId: string): ContextualContentReleaseManifest | null {
    const stored = this.rows.get(releaseId);
    if (!stored) {
      return null;
    }
    const parsed = parseReleaseManifest(stored);
    return parsed ? cloneFrozen(parsed) : null;
  }

  private readPointer(sceneId: string): ContextualContentActiveReleasePointer | null {
    const stored = this.pointers.get(sceneId);
    if (!stored) {
      return null;
    }
    const parsed = parseActiveReleasePointer(stored);
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
