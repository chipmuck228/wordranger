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

export type VocabularyImportStatusClass = "HTTP_4XX" | "HTTP_5XX" | "NO_STATUS";

export type VocabularyImportTable =
  | "vocabulary_source_entries"
  | "lexemes"
  | "lexeme_relations"
  | "lexeme_tags";

export type VocabularyImportOperation =
  | "SOURCE_ENTRIES_UPSERT"
  | "LEXEMES_UPSERT"
  | "LEXEME_ABBREVIATIONS_UPDATE"
  | "RELATIONS_UPSERT"
  | "TAGS_UPSERT";

const SAFE_CODE = /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/;

export interface VocabularyImportBatchErrorJson {
  name: "VocabularyImportBatchError";
  code: "VOCABULARY_IMPORT_BATCH_FAILED";
  kind: VocabularyImportErrorKind;
  table: VocabularyImportTable;
  operation: VocabularyImportOperation;
  batchIndex: number;
  batchStart: number;
  batchSize: number;
  providerCode: string | null;
  statusClass: VocabularyImportStatusClass;
}

function readRecord(error: unknown): Record<string, unknown> {
  return error && typeof error === "object"
    ? (error as Record<string, unknown>)
    : {};
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

export function sanitizeProviderCode(value: unknown): string | null {
  return typeof value === "string" && SAFE_CODE.test(value) ? value : null;
}

export function classifyHttpStatusClass(
  httpStatus?: unknown,
): VocabularyImportStatusClass {
  let status: number | null = null;
  if (typeof httpStatus === "number" && Number.isInteger(httpStatus)) {
    status = httpStatus;
  } else if (typeof httpStatus === "string" && /^\d{3}$/.test(httpStatus)) {
    status = Number(httpStatus);
  }
  if (status !== null && status >= 400 && status <= 499) {
    return "HTTP_4XX";
  }
  if (status !== null && status >= 500 && status <= 599) {
    return "HTTP_5XX";
  }
  return "NO_STATUS";
}

export class VocabularyImportBatchError extends Error {
  readonly name = "VocabularyImportBatchError";
  readonly code = "VOCABULARY_IMPORT_BATCH_FAILED" as const;
  readonly kind: VocabularyImportErrorKind;
  readonly table: VocabularyImportTable;
  readonly operation: VocabularyImportOperation;
  readonly batchIndex: number;
  readonly batchStart: number;
  readonly batchSize: number;
  readonly providerCode: string | null;
  readonly statusClass: VocabularyImportStatusClass;

  constructor(input: {
    table: VocabularyImportTable;
    operation: VocabularyImportOperation;
    batchStart: number;
    batchSize: number;
    cause?: unknown;
    httpStatus?: unknown;
  }) {
    super(
      `Vocabulary import failed during ${input.operation} on ${input.table} at batchStart=${input.batchStart}`,
      input.cause === undefined ? undefined : { cause: input.cause },
    );
    this.kind = classifyImportFailure(input.cause);
    this.table = input.table;
    this.operation = input.operation;
    this.batchIndex = Math.floor(input.batchStart / VOCABULARY_IMPORT_BATCH_SIZE);
    this.batchStart = input.batchStart;
    this.batchSize = input.batchSize;
    this.providerCode = sanitizeProviderCode(readRecord(input.cause).code);
    this.statusClass = classifyHttpStatusClass(input.httpStatus);
  }

  toJSON(): VocabularyImportBatchErrorJson {
    return {
      name: this.name,
      code: this.code,
      kind: this.kind,
      table: this.table,
      operation: this.operation,
      batchIndex: this.batchIndex,
      batchStart: this.batchStart,
      batchSize: this.batchSize,
      providerCode: this.providerCode,
      statusClass: this.statusClass,
    };
  }
}

export function isVocabularyImportBatchError(
  error: unknown,
): error is VocabularyImportBatchError {
  return error instanceof VocabularyImportBatchError;
}
