import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import path from "node:path";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  parseReleaseManifest,
  type ContextualContentReleaseManifest,
} from "@/contextual-learning/candidate-v0/release";
import { contextualReleaseRoot, safeReleaseRecordPath } from "./release-artifact-path";
import type { ContextualContentReleaseRepository } from "./release-repository";
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
          .filter((name) => name.endsWith(".json"))
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
    this.write(stored);
    return { ok: true, record: cloneFrozen(stored), idempotent: false };
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
