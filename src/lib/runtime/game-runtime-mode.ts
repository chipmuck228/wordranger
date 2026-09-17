/**
 * Shared student-game runtime fixture switch.
 *
 * `RANGER_TRIAL_RUNTIME=memory` is the legacy name. It now selects the
 * in-memory fixture for Ranger Trial, Word Bubble, Matching, and Snake.
 * `GAME_RUNTIME=memory` is a backward-compatible alias. Production must
 * leave both unset so student routes use durable Supabase adapters.
 */
export function isMemoryGameRuntime(): boolean {
  return (
    process.env.GAME_RUNTIME === "memory" ||
    process.env.RANGER_TRIAL_RUNTIME === "memory"
  );
}
