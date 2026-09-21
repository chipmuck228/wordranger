import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import { parseReleaseManifest } from "@/contextual-learning/candidate-v0/release";
import { buildMealMigrationAuthority, manifestFromAuthority } from "@/server/contextual-content-release/authority";
import { FileContextualContentReleaseRepository } from "@/server/contextual-content-release/file-release-repository";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";

async function draft() {
  return manifestFromAuthority({
    authority: await buildMealMigrationAuthority(),
    createdAt: "2026-09-22T00:00:00.000Z",
  });
}

describe("release repositories", () => {
  it("creates, gets, lists, and clones on read/write", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const record = await draft();
    const created = await repository.create({ record });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    const loaded = await repository.get(record.releaseId);
    expect(loaded?.releaseId).toBe(record.releaseId);
    if (!loaded) {
      throw new Error("missing");
    }
    expect(Object.isFrozen(loaded)).toBe(true);
    const mutated = structuredClone(loaded);
    mutated.status = "PUBLISHED";
    const again = await repository.get(record.releaseId);
    expect(again?.status).toBe("DRAFT");
    expect(mutated.status).toBe("PUBLISHED");
    const listed = await repository.list();
    expect(listed).toHaveLength(1);
    expect(Object.isFrozen(listed[0])).toBe(true);
    expect((await repository.get(record.releaseId))?.revision).toBe(0);
  });

  it("increments CAS revision and rejects stale writes", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const record = await draft();
    await repository.create({ record });
    const next = cloneFrozen({
      ...record,
      status: "PREFLIGHT_VALIDATED" as const,
      validatedAt: "2026-09-22T00:00:01.000Z",
      validationSummary: { ok: true, issues: [] },
    });
    const saved = await repository.saveIfRevision({ record: next, expectedRevision: 0 });
    expect(saved.ok).toBe(true);
    expect(saved.ok && saved.record.revision).toBe(1);
    const stale = await repository.saveIfRevision({ record: next, expectedRevision: 0 });
    expect(stale).toMatchObject({ ok: false, code: "RELEASE_CONFLICT" });
  });

  it("lets only one concurrent same-revision write succeed", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const record = await draft();
    await repository.create({ record });
    const next = cloneFrozen({
      ...record,
      status: "PREFLIGHT_VALIDATED" as const,
      validatedAt: "2026-09-22T00:00:01.000Z",
      validationSummary: { ok: true, issues: [] },
    });
    const [a, b] = await Promise.all([
      repository.saveIfRevision({ record: next, expectedRevision: 0 }),
      repository.saveIfRevision({ record: next, expectedRevision: 0 }),
    ]);
    const results = [a, b];
    expect(results.filter((item) => item.ok)).toHaveLength(1);
    expect(results.filter((item) => !item.ok && item.code === "RELEASE_CONFLICT")).toHaveLength(1);
    expect((await repository.get(record.releaseId))?.revision).toBe(1);
  });

  it("returns the same record for an idempotent retry", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const record = await draft();
    const first = await repository.create({ record });
    const second = await repository.create({ record });
    expect(first.ok && first.idempotent).toBe(false);
    expect(second.ok && second.idempotent).toBe(true);
    expect(second.ok && second.record.releaseFingerprint).toBe(record.releaseFingerprint);
  });

  it("rejects malformed and unknown schemas", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const record = await draft();
    await repository.create({ record });
    repository.replaceRaw({
      ...record,
      schemaVersion: "candidate-v9",
    } as never);
    expect(await repository.get(record.releaseId)).toBeNull();
    expect(parseReleaseManifest({ schemaVersion: "unknown" })).toBeNull();
    const invalid = await repository.saveIfRevision({
      record: { ...record, schemaVersion: "candidate-v9" } as never,
      expectedRevision: 0,
    });
    expect(invalid).toMatchObject({ ok: false, code: "RELEASE_INVALID" });
  });

  it("file adapter uses atomic writes and clone semantics", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "release-repo-"));
    const repository = new FileContextualContentReleaseRepository((releaseId) =>
      path.join(dir, `${releaseId}.json`),
    );
    const record = await draft();
    const created = await repository.create({ record });
    expect(created.ok).toBe(true);
    const loaded = await repository.get(record.releaseId);
    expect(loaded?.status).toBe("DRAFT");
    writeFileSync(path.join(dir, `${record.releaseId}.json`), '{"schemaVersion":"nope"}\n');
    expect(await repository.get(record.releaseId)).toBeNull();
  });
});
