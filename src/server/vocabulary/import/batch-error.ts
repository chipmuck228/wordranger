import {
  PersistenceTimeoutError,
  isAbortLike,
  isPersistenceTimeoutError,
} from "@/lib/runtime/persistence-timeout";

export const VOCABULARY_IMPORT_BATCH_SIZE = 200;

export type VocabularyImportErrorKind =
  | "POSTGREST_ERROR"
  | "NETWORK_OR_TIMEOUT_ERROR"
  | "UNKNOWN_IMPORT_ERROR";

export type VocabularyImportTable =
  | "vocabulary_source_entries"
  | "lexemes"
  | "lexeme_relations"
  | "lexeme_tags";

const SAFE_CODE = /^[A-Z0-9_]{2,32}$/;
const FORBIDDEN_TEXT =
  /https?:\/\/|supabase\.co|postgres:\/\/|eyJ|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i;

export interface VocabularyImportBatchErrorJson {
  name: "VocabularyImportBatchError";
  code: "VOCABULARY_IMPORT_BATCH_FAILED";
  kind: VocabularyImportErrorKind;
  table: VocabularyImportTable;
  phase: "upsert";
  batchIndex: number;
  batchStart: number;
  batchSize: number;
  providerCode: string | null;
  providerMessage: string | null;
  providerHint: string | null;
  providerDetails: string | null;
}

function isSafeProviderText(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) {
    return false;
  }
  if (FORBIDDEN_TEXT.test(trimmed)) {
    return false;
  }
  if (trimmed.includes("{") || trimmed.includes("[") || trimmed.includes("\\")) {
    return false;
  }
  return true;
}

function readString(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

export function classifyImportFailure(error: unknown): VocabularyImportErrorKind {
  if (isPersistenceTimeoutError(error) || isAbortLike(error)) {
    return "NETWORK_OR_TIMEOUT_ERROR";
  }
  if (error instanceof PersistenceTimeoutError) {
    return "NETWORK_OR_TIMEOUT_ERROR";
  }
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    if (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("enotfound")
    ) {
      return "NETWORK_OR_TIMEOUT_ERROR";
    }
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const code = record.code;
    if (typeof code === "string" && SAFE_CODE.test(code)) {
      return "POSTGREST_ERROR";
    }
    if (typeof record.message === "string" && typeof record.details !== "undefined") {
      return "POSTGREST_ERROR";
    }
  }
  return "UNKNOWN_IMPORT_ERROR";
}

export function sanitizeProviderField(value: unknown): string | null {
  return isSafeProviderText(value) ? value.trim() : null;
}

export function sanitizeProviderCode(value: unknown): string | null {
  return typeof value === "string" && SAFE_CODE.test(value) ? value : null;
}

export class VocabularyImportBatchError extends Error {
  readonly name = "VocabularyImportBatchError";
  readonly code = "VOCABULARY_IMPORT_BATCH_FAILED" as const;
  readonly kind: VocabularyImportErrorKind;
  readonly table: VocabularyImportTable;
  readonly phase = "upsert" as const;
  readonly batchIndex: number;
  readonly batchStart: number;
  readonly batchSize: number;
  readonly providerCode: string | null;
  readonly providerMessage: string | null;
  readonly providerHint: string | null;
  readonly providerDetails: string | null;

  constructor(input: {
    table: VocabularyImportTable;
    batchStart: number;
    batchSize: number;
    cause?: unknown;
  }) {
    const kind = classifyImportFailure(input.cause);
    const record =
      input.cause && typeof input.cause === "object"
        ? (input.cause as Record<string, unknown>)
        : {};
    const providerCode = sanitizeProviderCode(readString(record, "code"));
    const providerMessage = sanitizeProviderField(readString(record, "message"));
    super(
      `Vocabulary import failed during upsert of ${input.table} at batchStart=${input.batchStart}`,
    );
    this.kind = kind;
    this.table = input.table;
    this.batchIndex = Math.floor(input.batchStart / VOCABULARY_IMPORT_BATCH_SIZE);
    this.batchStart = input.batchStart;
    this.batchSize = input.batchSize;
    this.providerCode = providerCode;
    this.providerMessage = providerMessage;
    this.providerHint = sanitizeProviderField(readString(record, "hint"));
    this.providerDetails = sanitizeProviderField(readString(record, "details"));
    if (input.cause !== undefined) {
      this.cause = input.cause;
    }
  }

  toJSON(): VocabularyImportBatchErrorJson {
    return {
      name: this.name,
      code: this.code,
      kind: this.kind,
      table: this.table,
      phase: this.phase,
      batchIndex: this.batchIndex,
      batchStart: this.batchStart,
      batchSize: this.batchSize,
      providerCode: this.providerCode,
      providerMessage: this.providerMessage,
      providerHint: this.providerHint,
      providerDetails: this.providerDetails,
    };
  }
}

export function isVocabularyImportBatchError(
  error: unknown,
): error is VocabularyImportBatchError {
  return error instanceof VocabularyImportBatchError;
}
