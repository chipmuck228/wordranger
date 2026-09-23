import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createContextualContentTestWorkspace,
  seedOrdinaryE2EFixtures,
  type ContextualContentTestWorkspace,
} from "../tests/contextual-content-workspace";

export const ORDINARY_E2E_WORKSPACE_STATE = path.join(
  tmpdir(),
  "wordranger-ordinary-e2e-workspace.json",
);

let cached: ContextualContentTestWorkspace | null = null;

function workspaceFromRoot(
  root: string,
  token: string,
): ContextualContentTestWorkspace {
  const reviewRoot = path.join(root, "reviews");
  const promotionRoot = path.join(root, "promotions");
  const releaseRoot = path.join(root, "releases");
  return {
    root,
    token,
    reviewRoot,
    promotionRoot,
    releaseRoot,
    env: {
      CONTEXTUAL_CONTENT_REVIEW_ROOT: reviewRoot,
      CONTEXTUAL_CONTENT_PROMOTION_ROOT: promotionRoot,
      CONTEXTUAL_CONTENT_RELEASE_ROOT: releaseRoot,
    },
  };
}

export function ordinaryE2EWorkspace(): ContextualContentTestWorkspace {
  if (process.env.CONTEXT_LAB_REAL_RELEASE_E2E === "1") {
    throw new Error("Ordinary E2E workspace must not be created for real-release Chromium.");
  }
  if (cached) {
    return cached;
  }
  if (existsSync(ORDINARY_E2E_WORKSPACE_STATE)) {
    const state = JSON.parse(readFileSync(ORDINARY_E2E_WORKSPACE_STATE, "utf8")) as {
      root: string;
      token: string;
    };
    cached = workspaceFromRoot(state.root, state.token);
    Object.assign(process.env, cached.env);
    return cached;
  }
  cached = createContextualContentTestWorkspace("ordinary-e2e");
  seedOrdinaryE2EFixtures(cached);
  writeFileSync(
    ORDINARY_E2E_WORKSPACE_STATE,
    `${JSON.stringify({ root: cached.root, token: cached.token }, null, 2)}\n`,
  );
  Object.assign(process.env, cached.env);
  return cached;
}

export function ordinaryE2EWorkspaceEnv(): ContextualContentTestWorkspace["env"] {
  return ordinaryE2EWorkspace().env;
}
