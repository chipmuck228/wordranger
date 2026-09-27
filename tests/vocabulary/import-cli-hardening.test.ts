import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PersistenceTimeoutError } from "@/lib/runtime/persistence-timeout";
import { applyVocabularyImport } from "@/server/vocabulary/import/apply-import";
import {
  VocabularyImportBatchError,
  VOCABULARY_IMPORT_BATCH_SIZE,
} from "@/server/vocabulary/import/batch-error";
import {
  VOCABULARY_IMPORT_SERVICE_ROLE_REQUIRED,
  VOCABULARY_IMPORT_UNKNOWN_FAILURE,
  attachVocabularyImportCliHandler,
  formatVocabularyImportFailure,
  runVocabularyImportCli,
} from "@/server/vocabulary/import/run-cli";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";

type UpsertCall = {
  table: string;
  startId: unknown;
  size: number;
};

function fakeClient(
  handler: (
    table: string,
    rows: Record<string, unknown>[],
  ) => Promise<{ error: object | null }> | { error: object | null },
): { client: SupabaseClient; calls: UpsertCall[] } {
  const calls: UpsertCall[] = [];
  const client = {
    from(table: string) {
      return {
        async upsert(rows: Record<string, unknown>[]) {
          calls.push({
            table,
            startId: rows[0]?.id ?? rows[0]?.lexeme_id,
            size: rows.length,
          });
          return handler(table, rows);
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function ioSink() {
  const logs: unknown[][] = [];
  const errors: unknown[][] = [];
  return {
    logs,
    errors,
    io: {
      log: (...values: unknown[]) => {
        logs.push(values);
      },
      error: (...values: unknown[]) => {
        errors.push(values);
      },
    },
    text() {
      return JSON.stringify({ logs, errors });
    },
  };
}

describe("vocabulary importer fail-closed hardening", () => {
  it("refuses apply without service-role even when anon is present", async () => {
    let upserts = 0;
    const sink = ioSink();
    const result = await runVocabularyImportCli(
      ["--apply"],
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
      sink.io,
      {
        createClient: () => null,
        apply: async () => {
          upserts += 1;
          throw new Error("apply should not run");
        },
      },
    );
    expect(result.exitCode).toBe(1);
    expect(upserts).toBe(0);
    expect(sink.text()).toContain(VOCABULARY_IMPORT_SERVICE_ROLE_REQUIRED);
    expect(sink.text()).toContain("does not fall back to the anon key");
    expect(sink.text()).not.toMatch(/eyJ|postgres:\/\//i);
  });

  it("keeps fingerprint, validate, and dry-run offline", async () => {
    for (const flag of ["--fingerprint", "--validate", "--dry-run"] as const) {
      const sink = ioSink();
      let created = 0;
      const result = await runVocabularyImportCli([flag], {}, sink.io, {
        createClient: () => {
          created += 1;
          return {} as SupabaseClient;
        },
      });
      expect(result.exitCode).toBe(0);
      expect(created).toBe(0);
      expect(sink.text()).toContain("1600");
      expect(sink.text()).toContain("1638");
    }
  });

  it("preserves first-batch PostgREST location and safe provider fields", async () => {
    const { client, calls } = fakeClient(async (table) => {
      if (table === "vocabulary_source_entries") {
        return {
          error: {
            code: "PGRST205",
            message: "Could not find the table",
            hint: "reload schema",
            details: "schema cache",
          },
        };
      }
      return { error: null };
    });
    await expect(
      applyVocabularyImport(loadVocabularyDataset(), client),
    ).rejects.toMatchObject({
      name: "VocabularyImportBatchError",
      table: "vocabulary_source_entries",
      batchStart: 0,
      batchSize: VOCABULARY_IMPORT_BATCH_SIZE,
      kind: "POSTGREST_ERROR",
      providerCode: "PGRST205",
      providerMessage: "Could not find the table",
    });
    expect(calls[0]).toMatchObject({
      table: "vocabulary_source_entries",
      size: VOCABULARY_IMPORT_BATCH_SIZE,
    });
    const sink = ioSink();
    await attachVocabularyImportCliHandler(
      Promise.reject(
        new VocabularyImportBatchError({
          table: "vocabulary_source_entries",
          batchStart: 0,
          batchSize: VOCABULARY_IMPORT_BATCH_SIZE,
          cause: {
            code: "PGRST205",
            message: "Could not find the table",
            hint: "reload schema",
            details: "schema cache",
          },
        }),
      ),
      sink.io,
    );
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    const printed = String(sink.errors[0]?.[0] ?? "");
    const parsed = JSON.parse(printed) as {
      batch?: { table?: string; batchStart?: number; batchSize?: number; providerCode?: string };
    };
    expect(parsed.batch?.table).toBe("vocabulary_source_entries");
    expect(parsed.batch?.providerCode).toBe("PGRST205");
    expect(parsed.batch?.batchStart).toBe(0);
    expect(parsed.batch?.batchSize).toBe(VOCABULARY_IMPORT_BATCH_SIZE);
    expect(printed).not.toMatch(/eyJ|postgres:\/\/|https?:\/\//i);
    expect(printed).not.toContain("[object Object]");
  });

  it("preserves a later-batch location and does not claim rollback", async () => {
    const { client, calls } = fakeClient(async (table) => {
      if (table === "lexeme_relations") {
        return {
          error: {
            code: "23503",
            message: "foreign key violation",
          },
        };
      }
      return { error: null };
    });
    try {
      await applyVocabularyImport(loadVocabularyDataset(), client);
      throw new Error("expected batch error");
    } catch (error) {
      expect(error).toBeInstanceOf(VocabularyImportBatchError);
      const batch = error as VocabularyImportBatchError;
      expect(batch.table).toBe("lexeme_relations");
      expect(batch.batchStart).toBe(0);
      expect(batch.providerCode).toBe("23503");
      expect(formatVocabularyImportFailure(batch).summary).not.toMatch(
        /rollback/i,
      );
    }
    expect(calls.some((call) => call.table === "vocabulary_source_entries")).toBe(
      true,
    );
    expect(calls.some((call) => call.table === "lexemes")).toBe(true);
    expect(calls.at(-1)?.table).toBe("lexeme_relations");
  });

  it("classifies timeout and network failures", async () => {
    const { client } = fakeClient(async () => {
      throw new PersistenceTimeoutError("Supabase request timed out");
    });
    await expect(
      applyVocabularyImport(loadVocabularyDataset(), client),
    ).rejects.toMatchObject({
      kind: "NETWORK_OR_TIMEOUT_ERROR",
      table: "vocabulary_source_entries",
      batchStart: 0,
    });
  });

  it("classifies unknown thrown objects without opaque unhandled rejection", async () => {
    const formatted = formatVocabularyImportFailure({ opaque: true });
    expect(formatted.code).toBe(VOCABULARY_IMPORT_UNKNOWN_FAILURE);
    expect(JSON.stringify(formatted)).not.toContain("[object Object]");
    const sink = ioSink();
    await attachVocabularyImportCliHandler(Promise.reject({ opaque: true }), sink.io);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    expect(sink.text()).toContain(VOCABULARY_IMPORT_UNKNOWN_FAILURE);
    expect(sink.text()).not.toContain("[object Object]");
    expect(sink.text()).not.toContain("UnhandledPromiseRejection");
  });

  it("keeps successful import order and counts", async () => {
    const { client, calls } = fakeClient(async () => ({ error: null }));
    const applied = await applyVocabularyImport(loadVocabularyDataset(), client);
    expect(applied.sourceEntries).toBe(1600);
    expect(applied.lexemes).toBe(1638);
    expect(applied.relations).toBe(716);
    expect(applied.tags).toBe(1638);
    expect(calls.map((call) => call.table)).toEqual([
      ...Array.from({ length: 8 }, () => "vocabulary_source_entries"),
      ...Array.from({ length: 9 }, () => "lexemes"),
      "lexemes",
      ...Array.from({ length: 4 }, () => "lexeme_relations"),
      ...Array.from({ length: 9 }, () => "lexeme_tags"),
    ]);
    const sink = ioSink();
    const result = await runVocabularyImportCli(
      ["--apply"],
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      },
      sink.io,
      {
        createClient: () => client,
        apply: async () => applied,
      },
    );
    expect(result.exitCode).toBe(0);
    expect(sink.logs[1]?.[0]).toBe("Applied vocabulary import");
  });

  it("binds the CLI to the service-role factory only", () => {
    const script = readFileSync(
      path.join(process.cwd(), "scripts/import-vocabulary.ts"),
      "utf8",
    );
    const cli = readFileSync(
      path.join(process.cwd(), "src/server/vocabulary/import/run-cli.ts"),
      "utf8",
    );
    expect(script).toContain("createSupabaseServiceRoleClient");
    expect(script).not.toContain("createSupabaseServerClient");
    expect(cli).toContain("createSupabaseServiceRoleClient");
    expect(cli).not.toContain("createSupabaseServerClient");
    expect(script).toContain("attachVocabularyImportCliHandler");
    expect(script).not.toMatch(/void main\s*\(\s*\)/);
  });
});
