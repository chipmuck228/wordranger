import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";

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

function promotionIntent(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "candidate-v0",
    kind: "CONTEXTUAL_CONTENT_BATCH_PROMOTION",
    sceneId: MEAL_RELEASE_SCENE_ID,
    packId: "meal-scene-expansion-batch-03",
    parentPackId: "meal-scene-expansion-batch-02",
    packFingerprint: "pack-print-a",
    lineageFingerprint: "lineage-print-a",
    targetApprovalBindings: [
      {
        reviewKey: "meal-expansion-batch-03-knife",
        target: { lexemeId: "lex-knife", senseId: "knife#eating-tool" },
        reviewRevision: 1,
        reviewDecision: "APPROVED",
        reviewedContentFingerprint: "knife-print",
        packTargetFingerprint: "knife-print",
        approvalPackId: "meal-scene-expansion-batch-03",
        sourceRefs: ["docs/source"],
      },
    ],
    decision: "PROMOTED",
    revision: 99,
    promotedAt: "2026-09-22T08:00:00.000Z",
    promotedBy: "LOCAL_INTERNAL_PROMOTER",
    ...overrides,
  };
}

describe("contextual content batch promotion SQL/RPC integration", () => {
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
        path.join(process.cwd(), "supabase/migrations/202609220003_contextual_content_batch_promotions.sql"),
        "utf8",
      ),
    );
    await exec(`
      alter function promote_contextual_content_batch(text, text, bigint, jsonb) owner to service_role;
    `);
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  it("creates with server revision, retries idempotently, and fail-closes CAS and malformed rows", async () => {
    const first = await scalar<Record<string, unknown>>(`
      select promote_contextual_content_batch(
        '${MEAL_RELEASE_SCENE_ID}',
        'meal-scene-expansion-batch-03',
        0,
        ${sqlLiteral(promotionIntent())}
      );
    `);
    expect(first).toMatchObject({ idempotent: false });
    expect((first.record as { revision: number }).revision).toBe(1);
    expect(
      await scalar<string>(`
        select revision::text from contextual_content_batch_promotions
        where scene_id = '${MEAL_RELEASE_SCENE_ID}'
          and pack_id = 'meal-scene-expansion-batch-03'
      `),
    ).toBe("1");
    expect(
      await scalar<string>(`
        select record->>'revision' from contextual_content_batch_promotions
        where scene_id = '${MEAL_RELEASE_SCENE_ID}'
          and pack_id = 'meal-scene-expansion-batch-03'
      `),
    ).toBe("1");

    const retry = await scalar<Record<string, unknown>>(`
      select promote_contextual_content_batch(
        '${MEAL_RELEASE_SCENE_ID}',
        'meal-scene-expansion-batch-03',
        0,
        ${sqlLiteral(promotionIntent())}
      );
    `);
    expect(retry).toMatchObject({ idempotent: true });
    expect((retry.record as { revision: number }).revision).toBe(1);

    await expect(
      scalar(`
        select promote_contextual_content_batch(
          '${MEAL_RELEASE_SCENE_ID}',
          'meal-scene-expansion-batch-03',
          0,
          ${sqlLiteral(promotionIntent({ packFingerprint: "changed" }))}
        );
      `),
    ).rejects.toThrow(/PROMOTION_CONFLICT/);

    const updated = await scalar<Record<string, unknown>>(`
      select promote_contextual_content_batch(
        '${MEAL_RELEASE_SCENE_ID}',
        'meal-scene-expansion-batch-03',
        1,
        ${sqlLiteral(promotionIntent({ packFingerprint: "pack-print-b" }))}
      );
    `);
    expect(updated).toMatchObject({ idempotent: false });
    expect((updated.record as { revision: number; packFingerprint: string }).revision).toBe(2);
    expect((updated.record as { packFingerprint: string }).packFingerprint).toBe("pack-print-b");

    await expect(
      exec(`
        insert into contextual_content_batch_promotions (
          scene_id, pack_id, schema_version, revision, pack_fingerprint, record
        ) values (
          'meal-scene-v0',
          'forged-pack',
          'candidate-v0',
          1,
          'row-print',
          ${sqlLiteral(promotionIntent({ packId: "forged-pack", packFingerprint: "other-print" }))}
        );
      `),
    ).rejects.toThrow();

    await expect(
      scalar(`
        select promote_contextual_content_batch(
          '${MEAL_RELEASE_SCENE_ID}',
          'meal-scene-expansion-batch-03',
          2,
          ${sqlLiteral({ ...promotionIntent(), answerKey: { leak: true } })}
        );
      `),
    ).rejects.toThrow(/PROMOTION_INVALID/);

    await expect(
      scalar(`
        select promote_contextual_content_batch(
          '${MEAL_RELEASE_SCENE_ID}',
          'meal-scene-expansion-batch-03',
          2,
          ${sqlLiteral(promotionIntent({ packFingerprint: "" }))}
        );
      `),
    ).rejects.toThrow(/PROMOTION_INVALID/);

    const [left, right] = await Promise.all([
      scalar<Record<string, unknown>>(`
        select promote_contextual_content_batch(
          '${MEAL_RELEASE_SCENE_ID}',
          'meal-scene-expansion-batch-03',
          2,
          ${sqlLiteral(promotionIntent({ packFingerprint: "pack-print-b" }))}
        );
      `),
      scalar<Record<string, unknown>>(`
        select promote_contextual_content_batch(
          '${MEAL_RELEASE_SCENE_ID}',
          'meal-scene-expansion-batch-03',
          2,
          ${sqlLiteral(promotionIntent({ packFingerprint: "pack-print-b" }))}
        );
      `),
    ]);
    expect(left.idempotent && right.idempotent).toBe(true);
    expect(await scalar<string>("select count(*)::text from contextual_content_batch_promotions")).toBe("1");
  });
});
