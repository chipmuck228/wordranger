export const TRANSACTIONAL_DIRECT_POSTGRES_IMPORT_LIVE_FLAG =
  "RUN_DEDICATED_TRANSACTIONAL_DIRECT_POSTGRES_IMPORT";

export function isTransactionalDirectPostgresImportLive(
  env: NodeJS.Dict<string> = process.env,
): boolean {
  return env[TRANSACTIONAL_DIRECT_POSTGRES_IMPORT_LIVE_FLAG] === "1";
}

export function requireLocalPostgresql16(available: boolean): void {
  if (!available) {
    throw new Error("LOCAL_POSTGRESQL_16_REQUIRED");
  }
}
