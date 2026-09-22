import { describe, expect, it, vi } from "vitest";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";
import { SupabaseContextualContentReleaseRepository } from "@/server/contextual-content-release/supabase-release-repository";
import { ReleasePersistenceInconsistencyError } from "@/server/contextual-content-release/row-manifest-consistency";
import { manifestFromAuthority, buildMealMigrationAuthority } from "@/server/contextual-content-release/authority";

function releaseRow(record: {
  releaseId: string;
  sceneId: string;
  status: string;
  revision: number;
  schemaVersion: string;
  publishedAt: string | null;
  publishedBy: string | null;
  supersededAt: string | null;
  supersededByReleaseId: string | null;
}) {
  return {
    release_id: record.releaseId,
    scene_id: record.sceneId,
    status: record.status,
    revision: record.revision,
    schema_version: record.schemaVersion,
    published_at: record.publishedAt,
    published_by: record.publishedBy,
    superseded_at: record.supersededAt,
    superseded_by_release_id: record.supersededByReleaseId,
    manifest: record,
  };
}

function client(input: {
  rpc?: (name: string) => Promise<{ data: unknown; error: null | { message: string } }>;
  release: unknown;
  pointer: unknown;
}) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () =>
                  table === "contextual_content_releases"
                    ? { data: input.release, error: null }
                    : { data: input.pointer, error: null },
                eq() {
                  return { select: async () => ({ data: [], error: null }) };
                },
              };
            },
            order: async () => ({
              data: table === "contextual_content_releases" ? [input.release] : [],
              error: null,
            }),
          };
        },
      };
    },
    rpc: input.rpc ?? (async () => ({ data: { ok: true }, error: null })),
  };
}

describe("supabase release repository", () => {
  it("publishes through one RPC instead of two independent updates", async () => {
    const rpc = vi.fn(async (name: string) => {
      expect(name).toBe("publish_contextual_content_release");
      return { data: { ok: true, idempotent: false }, error: null };
    });
    const authority = await buildMealMigrationAuthority();
    const draft = manifestFromAuthority({
      authority,
      createdAt: "2026-09-22T00:00:00.000Z",
    });
    const published = {
      ...draft,
      status: "PUBLISHED" as const,
      publishedAt: "2026-09-22T00:00:02.000Z",
      publishedBy: "LOCAL_INTERNAL_RELEASER",
      revision: 1,
    };
    const pointer = {
      schema_version: "candidate-v0",
      scene_id: MEAL_RELEASE_SCENE_ID,
      release_id: published.releaseId,
      release_fingerprint: published.releaseFingerprint,
      revision: 0,
      activated_at: "2026-09-22T00:00:02.000Z",
      activated_by: "LOCAL_INTERNAL_RELEASER",
    };
    const repository = new SupabaseContextualContentReleaseRepository(
      client({ rpc, release: releaseRow(published), pointer }) as never,
    );
    const result = await repository.publishAtomic({
      record: published,
      expectedRevision: 0,
      expectedPointerRevision: null,
      pointer: {
        schemaVersion: "candidate-v0",
        kind: "CANDIDATE_V0_ACTIVE_RELEASE_POINTER",
        sceneId: MEAL_RELEASE_SCENE_ID,
        releaseId: published.releaseId,
        releaseFingerprint: published.releaseFingerprint,
        revision: 0,
        activatedAt: "2026-09-22T00:00:02.000Z",
        activatedBy: "LOCAL_INTERNAL_RELEASER",
      },
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.record.revision).toBe(1);
    expect(result.record.status).toBe("PUBLISHED");
  });

  it("fails closed when row columns disagree with the stored manifest", async () => {
    const authority = await buildMealMigrationAuthority();
    const draft = manifestFromAuthority({
      authority,
      createdAt: "2026-09-22T00:00:00.000Z",
    });
    const mismatched = releaseRow({
      ...draft,
      status: "PREFLIGHT_VALIDATED",
      revision: 0,
    });
    mismatched.status = "PUBLISHED";
    mismatched.revision = 4;
    const repository = new SupabaseContextualContentReleaseRepository(
      client({
        release: mismatched,
        pointer: null,
      }) as never,
    );
    await expect(repository.get(draft.releaseId)).rejects.toBeInstanceOf(ReleasePersistenceInconsistencyError);
    await expect(repository.list()).rejects.toBeInstanceOf(ReleasePersistenceInconsistencyError);
  });
});
