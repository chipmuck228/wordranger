import "server-only";

import { RANGER_TRIAL_GAME_ID } from "@/server/auth/v1-user";

/**
 * Evidence.gameId names the renderer that actually presented the task.
 * Context Lab reuses Ranger Trial `TextInputTaskRenderer` for Meal typing,
 * so RANGER_TRIAL is the truthful frozen renderer identity.
 * Context Lab remains orchestration identity only. Do not invent CONTEXT_LAB.
 */
export const CONTEXT_LAB_FROZEN_RENDERER_GAME_ID = RANGER_TRIAL_GAME_ID;
