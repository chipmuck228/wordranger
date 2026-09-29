import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VocabularyDataset } from "../load-vocabulary-dataset";
import { loadVocabularyDataset } from "../load-vocabulary-dataset";
import { applyVocabularyImport } from "./apply-import";
import {
  isVocabularyImportBatchError,
  type VocabularyImportBatchErrorJson,
} from "./batch-error";
import { planVocabularyImport } from "./plan-import";
import { buildVocabularySeedManifest } from "./rebuild-contract";

export const VOCABULARY_IMPORT_SERVICE_ROLE_REQUIRED =
  "VOCABULARY_IMPORT_SERVICE_ROLE_REQUIRED" as const;
export const VOCABULARY_IMPORT_UNKNOWN_FAILURE =
  "VOCABULARY_IMPORT_UNKNOWN_FAILURE" as const;
export const VOCABULARY_IMPORT_APPLIED =
  "VOCABULARY_IMPORT_APPLIED" as const;

export type VocabularyImportCliMode =
  | "validate"
  | "dry-run"
  | "apply"
  | "fingerprint";

export interface VocabularyImportCliIo {
  log: (...values: unknown[]) => void;
  error: (...values: unknown[]) => void;
}

export interface VocabularyImportCliDeps {
  loadDataset?: () => VocabularyDataset;
  createClient?: (
    env?: Record<string, string | undefined>,
  ) => SupabaseClient | null;
  apply?: typeof applyVocabularyImport;
}

export interface VocabularyImportCliResult {
  exitCode: number;
  mode: VocabularyImportCliMode;
}

export function parseVocabularyImportMode(
  argv: string[],
): VocabularyImportCliMode {
  if (argv.includes("--fingerprint")) {
    return "fingerprint";
  }
  if (argv.includes("--validate")) {
    return "validate";
  }
  if (argv.includes("--apply")) {
    return "apply";
  }
  return "dry-run";
}

export function formatVocabularyImportFailure(error: unknown): {
  code:
    | typeof VOCABULARY_IMPORT_SERVICE_ROLE_REQUIRED
    | typeof VOCABULARY_IMPORT_UNKNOWN_FAILURE
    | "VOCABULARY_IMPORT_BATCH_FAILED"
    | "VOCABULARY_IMPORT_QA_REFUSED";
  summary: string;
  batch?: VocabularyImportBatchErrorJson;
} {
  if (isVocabularyImportBatchError(error)) {
    return {
      code: error.code,
      summary: error.message,
      batch: error.toJSON(),
    };
  }
  if (error instanceof Error && error.message.startsWith("Refusing to apply")) {
    return {
      code: "VOCABULARY_IMPORT_QA_REFUSED",
      summary: error.message,
    };
  }
  return {
    code: VOCABULARY_IMPORT_UNKNOWN_FAILURE,
    summary: "Vocabulary import failed with an unclassified error.",
  };
}

export async function runVocabularyImportCli(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
  io: VocabularyImportCliIo = {
    log: (value) => console.log(value),
    error: (value) => console.error(value),
  },
  deps: VocabularyImportCliDeps = {},
): Promise<VocabularyImportCliResult> {
  const mode = parseVocabularyImportMode(argv);
  const loadDataset = deps.loadDataset ?? loadVocabularyDataset;
  const dataset = loadDataset();

  if (mode === "fingerprint") {
    io.log(JSON.stringify(buildVocabularySeedManifest(dataset), null, 2));
    return { exitCode: 0, mode };
  }

  const plan = planVocabularyImport(dataset, mode);
  io.log(JSON.stringify(plan, null, 2));

  if (mode !== "apply") {
    return { exitCode: 0, mode };
  }

  const createClient = deps.createClient ?? createSupabaseServiceRoleClient;
  const client = createClient(env);
  if (!client) {
    io.error(
      JSON.stringify(
        {
          code: VOCABULARY_IMPORT_SERVICE_ROLE_REQUIRED,
          summary:
            "Apply mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The importer does not fall back to the anon key.",
        },
        null,
        2,
      ),
    );
    return { exitCode: 1, mode };
  }

  const apply = deps.apply ?? applyVocabularyImport;
  const applied = await apply(dataset, client);
  io.log(
    JSON.stringify(
      {
        code: VOCABULARY_IMPORT_APPLIED,
        sourceEntries: applied.sourceEntries,
        lexemes: applied.lexemes,
        relations: applied.relations,
        tags: applied.tags,
      },
      null,
      2,
    ),
  );
  return { exitCode: 0, mode };
}

export function attachVocabularyImportCliHandler(
  work: Promise<VocabularyImportCliResult>,
  io: VocabularyImportCliIo = {
    log: (value) => console.log(value),
    error: (value) => console.error(value),
  },
): Promise<void> {
  return work.then(
    (result) => {
      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    },
    (error: unknown) => {
      process.exitCode = 1;
      io.error(JSON.stringify(formatVocabularyImportFailure(error), null, 2));
    },
  );
}
