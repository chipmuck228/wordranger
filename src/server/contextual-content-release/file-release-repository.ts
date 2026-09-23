import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import path from "node:path";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  fingerprintsForManifest,
  parseActiveReleasePointer,
  parseReleaseManifest,
  type ContextualContentActiveReleasePointer,
  type ContextualContentReleaseManifest,
} from "@/contextual-learning/candidate-v0/release";
import {
  contextualReleaseRoot,
  safeActivePointerPath,
  safeReleaseRecordPath,
} from "./release-artifact-path";
import type {
  ActiveReleaseLoadResult,
  ContextualContentReleaseRepository,
  PublishAtomicResult,
  RollbackPointerResult,
} from "./release-repository";
import {
  parsePublishAtom,
  publishedManifestFromStored,
  rejectPublishIdentity,
  restoredPublishedManifestFromStored,
  supersededManifestFromStored,
} from "./release-lifecycle";
import type { ReleaseSaveResult } from "./types";

export class FileContextualContentReleaseRepository
  implements ContextualContentReleaseRepository
{
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePathFor = safeReleaseRecordPath) {}

  async create(input: {
    record: ContextualContentReleaseManifest;
  }): Promise<ReleaseSaveResult> {
    return this.enqueue(() => this.createSync(input.record));
  }

  async get(releaseId: string): Promise<ContextualContentReleaseManifest | null> {
    return this.enqueue(() => this.read(releaseId));
  }

  async list(): Promise<ContextualContentReleaseManifest[]> {
    return this.enqueue(() => {
      const root = contextualReleaseRoot();
      try {
        return readdirSync(root)
          .filter((name) => name.endsWith(".json") && !name.startsWith("pointer-"))
          .sort()
          .flatMap((name) => {
            const releaseId = name.replace(/\.json$/, "");
            const record = this.read(releaseId);
            return record ? [record] : [];
          });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return [];
        }
        throw error;
      }
    });
  }

  async saveIfRevision(input: {
    record: ContextualContentReleaseManifest;
    expectedRevision: number;
  }): Promise<ReleaseSaveResult> {
    return this.enqueue(() => this.saveSync(input.record, input.expectedRevision));
  }

  async listByScene(sceneId: string): Promise<ContextualContentReleaseManifest[]> {
    const listed = await this.list();
    return listed.filter((item) => item.sceneId === sceneId);
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
      const filePath = this.filePathFor(input.releaseId);
      if (!filePath) {
        return { ok: false, code: "RELEASE_INVALID", message: "Release path is not server-controlled." };
      }
      try {
        unlinkSync(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
      return { ok: true, record: existing, idempotent: false };
    });
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
    this.write(parsed);
    return { ok: true, record: cloneFrozen(parsed), idempotent: false };
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
    this.write(stored);
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
    const parsedAtom = parsePublishAtom({ record: input.record, pointer: input.pointer });
    if (!parsedAtom) {
      return { ok: false, code: "RELEASE_INVALID", message: "Published snapshot or pointer is invalid." };
    }
    const { record: parsed, pointer } = parsedAtom;
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
    const identity = rejectPublishIdentity({ stored: existing, incoming: parsed, pointer });
    if (identity) {
      return identity;
    }
    if ((currentPointer?.revision ?? null) !== input.expectedPointerRevision) {
      return { ok: false, code: "RELEASE_CONFLICT", message: "Active pointer changed before publish." };
    }
    const nextRelease = publishedManifestFromStored({
      stored: existing,
      expectedRevision: input.expectedRevision,
      publishedAt: parsed.publishedAt ?? "",
      publishedBy: parsed.publishedBy ?? "",
    });
    if (!nextRelease.publishedAt || !nextRelease.publishedBy) {
      return { ok: false, code: "RELEASE_INVALID", message: "Published snapshot is missing publishedAt/publishedBy." };
    }
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
      if (
        superseded.releaseId !== currentSuperseded.releaseId ||
        superseded.releaseFingerprint !== currentSuperseded.releaseFingerprint
      ) {
        return { ok: false, code: "RELEASE_INVALID", message: "Supersede manifest identity does not match the stored release." };
      }
      nextSuperseded = supersededManifestFromStored({
        stored: currentSuperseded,
        expectedRevision: input.superseded.expectedRevision,
        supersededAt: superseded.supersededAt ?? nextRelease.publishedAt,
        supersededByReleaseId: nextRelease.releaseId,
      });
    }
    const nextPointer = cloneFrozen({
      ...pointer,
      revision:
        input.expectedPointerRevision === null ? 0 : input.expectedPointerRevision + 1,
    });
    this.write(nextRelease);
    if (nextSuperseded) {
      this.write(nextSuperseded);
    }
    this.writePointer(nextPointer);
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
    if (
      (target.status !== "PUBLISHED" && target.status !== "SUPERSEDED") ||
      target.publishedAt == null
    ) {
      return { ok: false, code: "RELEASE_NOT_PUBLISHED", message: "Only previously published releases can become active." };
    }
    if (pointer.releaseFingerprint !== target.releaseFingerprint) {
      return { ok: false, code: "RELEASE_INVALID", message: "Rollback pointer fingerprint does not match the target." };
    }
    if (current.releaseId !== target.releaseId) {
      const outgoing = this.read(current.releaseId);
      if (!outgoing) {
        return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
      }
      this.write(
        supersededManifestFromStored({
          stored: outgoing,
          expectedRevision: outgoing.revision,
          supersededAt: pointer.activatedAt,
          supersededByReleaseId: target.releaseId,
        }),
      );
    }
    const restored = restoredPublishedManifestFromStored({ stored: target });
    const nextPointer = cloneFrozen({
      ...pointer,
      revision: input.expectedPointerRevision + 1,
    });
    this.write(restored);
    this.writePointer(nextPointer);
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
    if (release.status !== "PUBLISHED" || release.sceneId !== sceneId) {
      return { ok: false, code: "RELEASE_POINTER_MISMATCH", message: "Active pointer is not bound to a published release." };
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
    const filePath = this.filePathFor(releaseId);
    if (!filePath) {
      return null;
    }
    try {
      const parsed = parseReleaseManifest(JSON.parse(readFileSync(filePath, "utf8")));
      return parsed ? cloneFrozen(parsed) : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private readPointer(sceneId: string): ContextualContentActiveReleasePointer | null {
    const filePath = safeActivePointerPath(sceneId);
    if (!filePath) {
      return null;
    }
    try {
      const parsed = parseActiveReleasePointer(JSON.parse(readFileSync(filePath, "utf8")));
      return parsed ? cloneFrozen(parsed) : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private writePointer(pointer: ContextualContentActiveReleasePointer): void {
    const filePath = safeActivePointerPath(pointer.sceneId);
    if (!filePath) {
      throw new Error("Unknown scene cannot control a pointer path.");
    }
    mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
    renameSync(tempPath, filePath);
  }

  private write(record: ContextualContentReleaseManifest): void {
    const filePath = this.filePathFor(record.releaseId);
    if (!filePath) {
      throw new Error("Unknown release cannot control an artifact path.");
    }
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
