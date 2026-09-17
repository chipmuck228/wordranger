/**
 * Core V1 has no authentication. Student-facing pages use this placeholder UUID
 * so durable Postgres uuid columns can store it. Do not accept userId from a
 * production form field. Auth/RLS remains future work.
 */
export const V1_PLACEHOLDER_USER_ID =
  "00000000-0000-4000-8000-000000000001";

export const RANGER_TRIAL_GAME_ID = "RANGER_TRIAL";
export const RANGER_TRIAL_GAME_TYPE = "RANGER_TRIAL";
export const RANGER_TRIAL_STATE_VERSION = "v1";

export const WORD_BUBBLE_GAME_ID = "WORD_BUBBLE";
export const WORD_BUBBLE_GAME_TYPE = "WORD_BUBBLE";

export const MATCHING_GAME_ID = "MATCHING";
export const MATCHING_GAME_TYPE = "MATCHING";

export const GAME_SESSION_STATE_VERSION = "v1";
