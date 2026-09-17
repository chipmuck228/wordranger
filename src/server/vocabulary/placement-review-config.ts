export type PlacementReviewStoreMode = "file" | "supabase";

export interface PlacementReviewRuntimeDiagnostics {
  supabaseUrlConfigured: boolean;
  serviceRoleConfigured: boolean;
  anonKeyConfigured: boolean;
  placementReviewStore: PlacementReviewStoreMode;
  placementReviewWritesEnabled: boolean;
}

export class CuratedPlacementConfigError extends Error {
  readonly code:
    | "CURATED_PLACEMENT_SUPABASE_NOT_CONFIGURED"
    | "CURATED_PLACEMENT_STORE_INVALID";

  constructor(
    code:
      | "CURATED_PLACEMENT_SUPABASE_NOT_CONFIGURED"
      | "CURATED_PLACEMENT_STORE_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "CuratedPlacementConfigError";
    this.code = code;
  }
}

export function placementReviewWritesEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.PLACEMENT_REVIEW_WRITE_ENABLED === "1";
}

export function resolvePlacementReviewStoreMode(
  env: NodeJS.ProcessEnv = process.env,
): PlacementReviewStoreMode {
  const raw = env.PLACEMENT_REVIEW_STORE?.trim();
  if (!raw || raw === "supabase") {
    return "supabase";
  }
  if (raw === "file") {
    return "file";
  }
  throw new CuratedPlacementConfigError(
    "CURATED_PLACEMENT_STORE_INVALID",
    `Unknown PLACEMENT_REVIEW_STORE "${raw}". Use supabase or file.`,
  );
}

/**
 * Internal diagnostics only. Never includes secret values.
 */
export function describePlacementReviewRuntime(
  env: NodeJS.ProcessEnv = process.env,
): PlacementReviewRuntimeDiagnostics {
  let placementReviewStore: PlacementReviewStoreMode = "supabase";
  try {
    placementReviewStore = resolvePlacementReviewStoreMode(env);
  } catch {
    placementReviewStore = "supabase";
  }
  return {
    supabaseUrlConfigured: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleConfigured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    anonKeyConfigured: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    placementReviewStore,
    placementReviewWritesEnabled: placementReviewWritesEnabled(env),
  };
}
