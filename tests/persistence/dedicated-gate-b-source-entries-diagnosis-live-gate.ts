export const GATE_B_SOURCE_ENTRIES_DIAGNOSIS_LIVE_FLAG =
  "RUN_DEDICATED_GATE_B_SOURCE_ENTRIES_DIAGNOSIS";

export function isDedicatedGateBSourceEntriesDiagnosisLive(
  env: NodeJS.Dict<string> = process.env,
): boolean {
  return env[GATE_B_SOURCE_ENTRIES_DIAGNOSIS_LIVE_FLAG] === "1";
}

export function requireLocalPostgresql16(available: boolean): void {
  if (!available) {
    throw new Error("LOCAL_POSTGRESQL_16_REQUIRED");
  }
}
