import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";
import { buildMealMigrationAuthority, manifestFromAuthority } from "@/server/contextual-content-release/authority";

let db: PGlite;

async function exec(sql: string): Promise<void> {
  await db.exec(sql);
}

async function query<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  const result = await db.query<T>(sql);
  return result.rows;
}

async function scalar<T>(sql: string): Promise<T> {
  const rows = await query<Record<string, T>>(sql);
  const row = rows[0];
  if (!row) {
    throw new Error(`SQL returned no rows: ${sql}`);
  }
  return Object.values(row)[0] as T;
}

function sqlLiteral(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

describe("contextual content release SQL/RPC integration", () => {
  beforeAll(async () => {
    db = new PGlite();
    await exec(`
      do $$
      begin
        if not exists (select from pg_roles where rolname = 'anon') then
          create role anon;
        end if;
        if not exists (select from pg_roles where rolname = 'authenticated') then
          create role authenticated;
        end if;
        if not exists (select from pg_roles where rolname = 'service_role') then
          create role service_role login superuser;
        end if;
      end
      $$;
    `);
    await exec(
      readFileSync(
        path.join(process.cwd(), "supabase/migrations_archive/pre_dedicated_baseline/202609220001_contextual_content_releases.sql"),
        "utf8",
      ),
    );
    await exec(
      readFileSync(
        path.join(process.cwd(), "supabase/migrations_archive/pre_dedicated_baseline/202609220002_contextual_content_active_releases.sql"),
        "utf8",
      ),
    );
    await exec(`
      alter function publish_contextual_content_release(text, bigint, jsonb, jsonb, bigint, text, bigint, jsonb) owner to service_role;
      alter function rollback_contextual_content_active_release(text, bigint, text, jsonb) owner to service_role;
    `);
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  it("keeps row and manifest revision/status equal across publish, supersede, rollback, and rejected writes", async () => {
    const authority = await buildMealMigrationAuthority();
    const draftA = manifestFromAuthority({
      authority,
      createdAt: "2026-09-22T01:00:00.000Z",
      releaseId: "meal-release-sql-a",
    });
    const draftB = manifestFromAuthority({
      authority,
      createdAt: "2026-09-22T02:00:00.000Z",
      releaseId: "meal-release-sql-b",
    });
    const preflightA = {
      ...draftA,
      status: "PREFLIGHT_VALIDATED" as const,
      validatedAt: "2026-09-22T01:00:01.000Z",
      validationSummary: { ok: true, issues: [] },
      revision: 0,
    };
    const preflightB = {
      ...draftB,
      status: "PREFLIGHT_VALIDATED" as const,
      validatedAt: "2026-09-22T02:00:01.000Z",
      validationSummary: { ok: true, issues: [] },
      revision: 0,
    };
    const publishedIntentA = {
      ...preflightA,
      status: "PUBLISHED" as const,
      publishedAt: "2026-09-22T01:00:02.000Z",
      publishedBy: "LOCAL_INTERNAL_RELEASER",
    };
    const publishedIntentB = {
      ...preflightB,
      status: "PUBLISHED" as const,
      publishedAt: "2026-09-22T02:00:02.000Z",
      publishedBy: "LOCAL_INTERNAL_RELEASER",
    };
    const pointerA = {
      schemaVersion: "candidate-v0",
      kind: "CANDIDATE_V0_ACTIVE_RELEASE_POINTER",
      sceneId: MEAL_RELEASE_SCENE_ID,
      releaseId: preflightA.releaseId,
      releaseFingerprint: preflightA.releaseFingerprint,
      revision: 0,
      activatedAt: "2026-09-22T01:00:02.000Z",
      activatedBy: "LOCAL_INTERNAL_RELEASER",
    };
    const pointerB = {
      ...pointerA,
      releaseId: preflightB.releaseId,
      releaseFingerprint: preflightB.releaseFingerprint,
      revision: 1,
      activatedAt: "2026-09-22T02:00:02.000Z",
    };

    await insertRelease(preflightA);
    await insertRelease(preflightB);

    const publishA = await scalar<Record<string, unknown>>(`
      select publish_contextual_content_release(
        '${preflightA.releaseId}',
        0,
        ${sqlLiteral(publishedIntentA)},
        ${sqlLiteral(pointerA)},
        null,
        null,
        null,
        null
      );
    `);
    expect(publishA).toMatchObject({ ok: true, idempotent: false });
    expect(await rowManifestParity(preflightA.releaseId)).toEqual({
      status: "PUBLISHED",
      revision: 1,
      equal: true,
    });

    const stale = await scalar<Record<string, unknown>>(`
      select publish_contextual_content_release(
        '${preflightB.releaseId}',
        0,
        ${sqlLiteral(publishedIntentB)},
        ${sqlLiteral(pointerB)},
        99,
        '${preflightA.releaseId}',
        1,
        ${sqlLiteral({ ...publishedIntentA, status: "SUPERSEDED" })}
      );
    `);
    expect(stale).toMatchObject({ ok: false, code: "RELEASE_CONFLICT" });
    expect(await rowManifestParity(preflightA.releaseId)).toEqual({
      status: "PUBLISHED",
      revision: 1,
      equal: true,
    });
    expect(await rowManifestParity(preflightB.releaseId)).toEqual({
      status: "PREFLIGHT_VALIDATED",
      revision: 0,
      equal: true,
    });
    expect(await scalar<string>("select count(*)::text from contextual_content_active_release_pointers")).toBe("1");

    const identityReject = await scalar<Record<string, unknown>>(`
      select publish_contextual_content_release(
        '${preflightB.releaseId}',
        0,
        ${sqlLiteral({ ...publishedIntentB, releaseId: "meal-release-forged" })},
        ${sqlLiteral(pointerB)},
        0,
        '${preflightA.releaseId}',
        1,
        ${sqlLiteral({ ...publishedIntentA, status: "SUPERSEDED" })}
      );
    `);
    expect(identityReject).toMatchObject({ ok: false, code: "RELEASE_INVALID" });
    expect((await rowManifestParity(preflightB.releaseId)).status).toBe("PREFLIGHT_VALIDATED");

    const publishB = await scalar<Record<string, unknown>>(`
      select publish_contextual_content_release(
        '${preflightB.releaseId}',
        0,
        ${sqlLiteral(publishedIntentB)},
        ${sqlLiteral(pointerB)},
        0,
        '${preflightA.releaseId}',
        1,
        ${sqlLiteral({ ...publishedIntentA, status: "SUPERSEDED", supersededAt: "2026-09-22T02:00:02.000Z" })}
      );
    `);
    expect(publishB).toMatchObject({ ok: true, idempotent: false });
    expect(await rowManifestParity(preflightB.releaseId)).toEqual({
      status: "PUBLISHED",
      revision: 1,
      equal: true,
    });
    expect(await rowManifestParity(preflightA.releaseId)).toEqual({
      status: "SUPERSEDED",
      revision: 2,
      equal: true,
    });

    const badPointer = await scalar<Record<string, unknown>>(`
      select rollback_contextual_content_active_release(
        '${MEAL_RELEASE_SCENE_ID}',
        1,
        '${preflightA.releaseId}',
        ${sqlLiteral({
          ...pointerA,
          releaseFingerprint: "0".repeat(64),
          revision: 2,
          activatedAt: "2026-09-22T03:00:00.000Z",
        })}
      );
    `);
    expect(badPointer).toMatchObject({ ok: false, code: "RELEASE_INVALID" });
    expect(await rowManifestParity(preflightA.releaseId)).toEqual({
      status: "SUPERSEDED",
      revision: 2,
      equal: true,
    });
    expect(
      await scalar<string>(
        `select release_id from contextual_content_active_release_pointers where scene_id = '${MEAL_RELEASE_SCENE_ID}'`,
      ),
    ).toBe(preflightB.releaseId);

    const rollback = await scalar<Record<string, unknown>>(`
      select rollback_contextual_content_active_release(
        '${MEAL_RELEASE_SCENE_ID}',
        1,
        '${preflightA.releaseId}',
        ${sqlLiteral({
          ...pointerA,
          revision: 2,
          activatedAt: "2026-09-22T03:00:00.000Z",
        })}
      );
    `);
    expect(rollback).toMatchObject({ ok: true, idempotent: false });
    expect(await rowManifestParity(preflightA.releaseId)).toEqual({
      status: "PUBLISHED",
      revision: 3,
      equal: true,
    });
    expect(await rowManifestParity(preflightB.releaseId)).toEqual({
      status: "SUPERSEDED",
      revision: 2,
      equal: true,
    });
    expect(
      await scalar<string>(
        `select release_id from contextual_content_active_release_pointers where scene_id = '${MEAL_RELEASE_SCENE_ID}'`,
      ),
    ).toBe(preflightA.releaseId);
    expect(
      await scalar<string>(
        `select manifest->>'status' from contextual_content_releases where release_id = '${preflightA.releaseId}'`,
      ),
    ).toBe("PUBLISHED");
    expect(
      await scalar<string>(
        `select status from contextual_content_releases where release_id = '${preflightA.releaseId}'`,
      ),
    ).toBe("PUBLISHED");
  });
});

async function insertRelease(record: {
  releaseId: string;
  sceneId: string;
  status: string;
  revision: number;
  schemaVersion: string;
  publishedAt: string | null;
  publishedBy: string | null;
  supersededAt: string | null;
  supersededByReleaseId: string | null;
}): Promise<void> {
  await exec(`
    insert into contextual_content_releases (
      release_id, user_id, schema_version, scene_id, status, revision, manifest,
      published_at, published_by, superseded_at, superseded_by_release_id
    ) values (
      '${record.releaseId}',
      '00000000-0000-4000-8000-000000000001',
      '${record.schemaVersion}',
      '${record.sceneId}',
      '${record.status}',
      ${record.revision},
      ${sqlLiteral(record)},
      ${record.publishedAt ? `'${record.publishedAt}'` : "null"},
      ${record.publishedBy ? `'${record.publishedBy}'` : "null"},
      ${record.supersededAt ? `'${record.supersededAt}'` : "null"},
      ${record.supersededByReleaseId ? `'${record.supersededByReleaseId}'` : "null"}
    );
  `);
}

async function rowManifestParity(releaseId: string): Promise<{
  status: string;
  revision: number;
  equal: boolean;
}> {
  const rows = await query<{
    status: string;
    revision: number | string;
    manifestStatus: string;
    manifestRevision: number | string;
    equal: boolean;
  }>(`
    select
      status,
      revision,
      manifest->>'status' as "manifestStatus",
      (manifest->>'revision')::bigint as "manifestRevision",
      (
        status is not distinct from manifest->>'status'
        and revision is not distinct from (manifest->>'revision')::bigint
      ) as equal
    from contextual_content_releases
    where release_id = '${releaseId}';
  `);
  const parsed = rows[0];
  if (!parsed) {
    throw new Error(`missing release ${releaseId}`);
  }
  return {
    status: parsed.status,
    revision: Number(parsed.revision),
    equal:
      parsed.equal &&
      parsed.status === parsed.manifestStatus &&
      Number(parsed.revision) === Number(parsed.manifestRevision),
  };
}
