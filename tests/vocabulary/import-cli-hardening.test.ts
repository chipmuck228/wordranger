import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PersistenceTimeoutError } from "@/lib/runtime/persistence-timeout";
import { applyVocabularyImport } from "@/server/vocabulary/import/apply-import";
import {
  VocabularyImportBatchError,
  VOCABULARY_IMPORT_BATCH_SIZE,
  type VocabularyImportBatchErrorJson,
} from "@/server/vocabulary/import/batch-error";
import {
  VOCABULARY_IMPORT_APPLIED,
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

function parseCliFailure(sink: ReturnType<typeof ioSink>): {
  printed: string;
  parsed: {
    code?: string;
    summary?: string;
    batch?: VocabularyImportBatchErrorJson;
  };
} {
  const printed = String(sink.errors[0]?.[0] ?? "");
  return {
    printed,
    parsed: JSON.parse(printed) as {
      code?: string;
      summary?: string;
      batch?: VocabularyImportBatchErrorJson;
    },
  };
}

function isAbbreviationUpdate(rows: Record<string, unknown>[]): boolean {
  return rows.some((row) => row.abbreviation_of_lexeme_id != null);
}

function publicBatchKeys(batch: VocabularyImportBatchErrorJson): string[] {
  return Object.keys(batch).sort();
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

  it("preserves first-batch PostgREST location and providerCode only", async () => {
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
      operation: "SOURCE_ENTRIES_UPSERT",
      batchStart: 0,
      batchSize: VOCABULARY_IMPORT_BATCH_SIZE,
      kind: "POSTGREST_ERROR",
      providerCode: "PGRST205",
    });
    expect(calls[0]).toMatchObject({
      table: "vocabulary_source_entries",
      size: VOCABULARY_IMPORT_BATCH_SIZE,
    });
    const error = new VocabularyImportBatchError({
      table: "vocabulary_source_entries",
      operation: "SOURCE_ENTRIES_UPSERT",
      batchStart: 0,
      batchSize: VOCABULARY_IMPORT_BATCH_SIZE,
      cause: {
        code: "PGRST205",
        message: "Could not find the table",
        hint: "reload schema",
        details: "schema cache",
      },
    });
    expect(error.toJSON()).not.toHaveProperty("providerMessage");
    expect(error.toJSON()).not.toHaveProperty("providerHint");
    expect(error.toJSON()).not.toHaveProperty("providerDetails");
    expect(publicBatchKeys(error.toJSON())).toEqual([
      "batchIndex",
      "batchSize",
      "batchStart",
      "code",
      "kind",
      "name",
      "operation",
      "providerCode",
      "table",
    ]);
    const sink = ioSink();
    await attachVocabularyImportCliHandler(Promise.reject(error), sink.io);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    const { printed, parsed } = parseCliFailure(sink);
    expect(parsed.summary).toContain("SOURCE_ENTRIES_UPSERT");
    expect(parsed.batch?.table).toBe("vocabulary_source_entries");
    expect(parsed.batch?.operation).toBe("SOURCE_ENTRIES_UPSERT");
    expect(parsed.batch?.providerCode).toBe("PGRST205");
    expect(parsed.batch?.batchStart).toBe(0);
    expect(parsed.batch?.batchSize).toBe(VOCABULARY_IMPORT_BATCH_SIZE);
    expect(printed).not.toContain("Could not find the table");
    expect(printed).not.toContain("reload schema");
    expect(printed).not.toContain("schema cache");
    expect(printed).not.toContain("providerMessage");
    expect(printed).not.toContain("providerHint");
    expect(printed).not.toContain("providerDetails");
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
      expect(batch.operation).toBe("RELATIONS_UPSERT");
      expect(batch.batchStart).toBe(0);
      expect(batch.providerCode).toBe("23503");
      const formatted = formatVocabularyImportFailure(batch);
      expect(formatted.summary).toContain("RELATIONS_UPSERT");
      expect(formatted.summary).not.toMatch(/rollback/i);
      expect(formatted.batch?.operation).toBe("RELATIONS_UPSERT");
    }
    expect(calls.some((call) => call.table === "vocabulary_source_entries")).toBe(
      true,
    );
    expect(calls.some((call) => call.table === "lexemes")).toBe(true);
    expect(calls.at(-1)?.table).toBe("lexeme_relations");
  });

  it("locates lexeme body first-batch failure as LEXEMES_UPSERT", async () => {
    const { client, calls } = fakeClient(async (table, rows) => {
      if (table === "lexemes" && !isAbbreviationUpdate(rows)) {
        return {
          error: {
            code: "PGRST205",
            message: "Could not find the table",
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
      expect(batch.table).toBe("lexemes");
      expect(batch.operation).toBe("LEXEMES_UPSERT");
      expect(batch.batchStart).toBe(0);
      expect(batch.batchSize).toBe(VOCABULARY_IMPORT_BATCH_SIZE);
      expect(batch.batchIndex).toBe(0);
      const sink = ioSink();
      await attachVocabularyImportCliHandler(Promise.reject(batch), sink.io);
      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
      const { printed, parsed } = parseCliFailure(sink);
      expect(parsed.summary).toContain("LEXEMES_UPSERT");
      expect(parsed.batch?.table).toBe("lexemes");
      expect(parsed.batch?.operation).toBe("LEXEMES_UPSERT");
      expect(parsed.batch?.batchStart).toBe(0);
      expect(parsed.batch?.batchSize).toBe(VOCABULARY_IMPORT_BATCH_SIZE);
      expect(printed).not.toContain("LEXEME_ABBREVIATIONS_UPDATE");
    }
    expect(calls.filter((call) => call.table === "lexemes")).toHaveLength(1);
  });

  it("locates abbreviation update first-batch failure as LEXEME_ABBREVIATIONS_UPDATE", async () => {
    const { client, calls } = fakeClient(async (table, rows) => {
      if (table === "lexemes" && isAbbreviationUpdate(rows)) {
        return {
          error: {
            code: "PGRST205",
            message: "Could not find the table",
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
      expect(batch.table).toBe("lexemes");
      expect(batch.operation).toBe("LEXEME_ABBREVIATIONS_UPDATE");
      expect(batch.batchStart).toBe(0);
      expect(batch.batchIndex).toBe(0);
      expect(batch.batchSize).toBeGreaterThan(0);
      expect(batch.batchSize).toBeLessThan(VOCABULARY_IMPORT_BATCH_SIZE);
      const sink = ioSink();
      await attachVocabularyImportCliHandler(Promise.reject(batch), sink.io);
      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
      const { printed, parsed } = parseCliFailure(sink);
      expect(parsed.summary).toContain("LEXEME_ABBREVIATIONS_UPDATE");
      expect(parsed.batch?.table).toBe("lexemes");
      expect(parsed.batch?.operation).toBe("LEXEME_ABBREVIATIONS_UPDATE");
      expect(parsed.batch?.batchStart).toBe(0);
      expect(parsed.batch?.batchSize).toBe(batch.batchSize);
      expect(printed).not.toContain("LEXEMES_UPSERT");
    }
    const lexemeCalls = calls.filter((call) => call.table === "lexemes");
    expect(lexemeCalls.length).toBeGreaterThan(1);
    expect(lexemeCalls.at(-1)?.size).toBeLessThan(VOCABULARY_IMPORT_BATCH_SIZE);
  });

  it("prints different operations for the two lexemes write stages", async () => {
    const bodyClient = fakeClient(async (table, rows) => {
      if (table === "lexemes" && !isAbbreviationUpdate(rows)) {
        return { error: { code: "23505", message: "duplicate" } };
      }
      return { error: null };
    });
    const abbrevClient = fakeClient(async (table, rows) => {
      if (table === "lexemes" && isAbbreviationUpdate(rows)) {
        return { error: { code: "23505", message: "duplicate" } };
      }
      return { error: null };
    });
    const bodyError = await applyVocabularyImport(
      loadVocabularyDataset(),
      bodyClient.client,
    ).then(
      () => {
        throw new Error("expected body failure");
      },
      (error: unknown) => error as VocabularyImportBatchError,
    );
    const abbrevError = await applyVocabularyImport(
      loadVocabularyDataset(),
      abbrevClient.client,
    ).then(
      () => {
        throw new Error("expected abbreviation failure");
      },
      (error: unknown) => error as VocabularyImportBatchError,
    );
    expect(bodyError.table).toBe("lexemes");
    expect(abbrevError.table).toBe("lexemes");
    expect(bodyError.batchStart).toBe(0);
    expect(abbrevError.batchStart).toBe(0);
    expect(bodyError.operation).toBe("LEXEMES_UPSERT");
    expect(abbrevError.operation).toBe("LEXEME_ABBREVIATIONS_UPDATE");
    expect(bodyError.operation).not.toBe(abbrevError.operation);
    const bodySink = ioSink();
    const abbrevSink = ioSink();
    await attachVocabularyImportCliHandler(Promise.reject(bodyError), bodySink.io);
    await attachVocabularyImportCliHandler(
      Promise.reject(abbrevError),
      abbrevSink.io,
    );
    process.exitCode = undefined;
    expect(parseCliFailure(bodySink).parsed.batch?.operation).toBe(
      "LEXEMES_UPSERT",
    );
    expect(parseCliFailure(abbrevSink).parsed.batch?.operation).toBe(
      "LEXEME_ABBREVIATIONS_UPDATE",
    );
    expect(parseCliFailure(bodySink).printed).not.toContain(
      "LEXEME_ABBREVIATIONS_UPDATE",
    );
    expect(parseCliFailure(abbrevSink).printed).not.toContain("LEXEMES_UPSERT");
  });

  it("accepts only SQLSTATE and PostgREST providerCode shapes", async () => {
    const cases = [
      { code: "SERVICE_ROLE_SECRET", expected: null },
      { code: "N9Q2F8K1P4X7", expected: null },
      { code: "PGRST205", expected: "PGRST205" },
      { code: "23505", expected: "23505" },
      { code: "42P01", expected: "42P01" },
    ] as const;
    for (const { code, expected } of cases) {
      const error = new VocabularyImportBatchError({
        table: "lexemes",
        operation: "LEXEMES_UPSERT",
        batchStart: 0,
        batchSize: VOCABULARY_IMPORT_BATCH_SIZE,
        cause: { code, message: "provider text must stay out of CLI" },
      });
      expect(error.providerCode).toBe(expected);
      const sink = ioSink();
      await attachVocabularyImportCliHandler(Promise.reject(error), sink.io);
      process.exitCode = undefined;
      const { printed, parsed } = parseCliFailure(sink);
      expect(parsed.batch?.providerCode).toBe(expected);
      if (expected === null) {
        expect(printed).not.toContain(code);
      } else {
        expect(printed).toContain(code);
      }
      expect(printed).not.toContain("provider text must stay out of CLI");
    }
  });

  it("omits provider prose, row values, and Error.cause from CLI output", async () => {
    const dataset = loadVocabularyDataset();
    const lemma = dataset.lexemes.find((row) => row.lemma.length >= 8)?.lemma;
    expect(lemma).toBeTruthy();
    const password = "n9q2f8k1p4x7";
    const url = "https://evil.example/secret-path";
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlciJ9.sig";
    const email = "attacker@example.com";
    const cause = {
      code: "not a valid code!!!",
      message: password,
      hint: url,
      details: {
        jwt,
        email,
        lemma,
        nested: {
          password,
          row: { lemma, source_word_raw: lemma },
        },
      },
    };
    const error = new VocabularyImportBatchError({
      table: "lexemes",
      operation: "LEXEMES_UPSERT",
      batchStart: 0,
      batchSize: VOCABULARY_IMPORT_BATCH_SIZE,
      cause,
    });
    expect(error.cause).toBe(cause);
    expect(error.providerCode).toBeNull();
    const json = error.toJSON();
    expect(json.providerCode).toBeNull();
    expect(json).not.toHaveProperty("providerMessage");
    expect(json).not.toHaveProperty("providerHint");
    expect(json).not.toHaveProperty("providerDetails");
    expect(json).not.toHaveProperty("cause");
    expect(JSON.stringify(json)).not.toContain(password);
    expect(JSON.stringify(json)).not.toContain(lemma);
    expect(JSON.stringify(json)).not.toContain(url);
    expect(JSON.stringify(json)).not.toContain(jwt);
    expect(JSON.stringify(json)).not.toContain(email);
    const sink = ioSink();
    await attachVocabularyImportCliHandler(Promise.reject(error), sink.io);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    const { printed, parsed } = parseCliFailure(sink);
    expect(parsed.batch?.operation).toBe("LEXEMES_UPSERT");
    expect(parsed.batch?.providerCode).toBeNull();
    expect(printed).not.toContain(password);
    expect(printed).not.toContain(lemma!);
    expect(printed).not.toContain(url);
    expect(printed).not.toContain(jwt);
    expect(printed).not.toContain(email);
    expect(printed).not.toContain("providerMessage");
    expect(printed).not.toContain("providerHint");
    expect(printed).not.toContain("providerDetails");
    expect(printed).not.toContain('"cause"');
    expect(printed).not.toMatch(/https?:\/\//i);
    expect(printed).not.toMatch(/eyJ/);
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
      operation: "SOURCE_ENTRIES_UPSERT",
      batchStart: 0,
    });
  });

  it("classifies unknown thrown objects without opaque unhandled rejection", async () => {
    const formatted = formatVocabularyImportFailure({ opaque: true });
    expect(formatted).toEqual({
      code: VOCABULARY_IMPORT_UNKNOWN_FAILURE,
      summary: "Vocabulary import failed with an unclassified error.",
    });
    expect(JSON.stringify(formatted)).not.toContain("[object Object]");
    expect(JSON.stringify(formatted)).not.toContain("opaque");
    const sink = ioSink();
    await attachVocabularyImportCliHandler(Promise.reject({ opaque: true }), sink.io);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    const { printed, parsed } = parseCliFailure(sink);
    expect(parsed).toEqual({
      code: VOCABULARY_IMPORT_UNKNOWN_FAILURE,
      summary: "Vocabulary import failed with an unclassified error.",
    });
    expect(sink.text()).toContain(VOCABULARY_IMPORT_UNKNOWN_FAILURE);
    expect(printed).not.toContain("[object Object]");
    expect(printed).not.toContain("UnhandledPromiseRejection");
    expect(printed).not.toContain("opaque");
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
    expect(sink.logs[1]).toHaveLength(1);
    expect(JSON.parse(String(sink.logs[1]?.[0]))).toEqual({
      code: VOCABULARY_IMPORT_APPLIED,
      sourceEntries: 1600,
      lexemes: 1638,
      relations: 716,
      tags: 1638,
    });
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
    expect(cli).toContain("VOCABULARY_IMPORT_APPLIED");
    expect(cli).not.toContain("Applied vocabulary import");
  });
});
