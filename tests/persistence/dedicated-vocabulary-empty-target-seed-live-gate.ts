export const EMPTY_TARGET_SEED_LIVE_FLAG =
  "RUN_DEDICATED_VOCABULARY_EMPTY_TARGET_SEED";

export function isEmptyTargetSeedLive(
  env: NodeJS.Dict<string> = process.env,
): boolean {
  return env[EMPTY_TARGET_SEED_LIVE_FLAG] === "1";
}

export function requireLocalPostgresql16(available: boolean): void {
  if (!available) {
    throw new Error("LOCAL_POSTGRESQL_16_REQUIRED");
  }
}
