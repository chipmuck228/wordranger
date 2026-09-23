import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  CONTEXTUAL_CONTENT_TEST_WORKSPACE_KIND,
  WORKSPACE_MARKER_NAME,
} from "./invariants";

export interface ContextualContentTestWorkspace {
  root: string;
  token: string;
  reviewRoot: string;
  promotionRoot: string;
  releaseRoot: string;
  env: {
    CONTEXTUAL_CONTENT_REVIEW_ROOT: string;
    CONTEXTUAL_CONTENT_PROMOTION_ROOT: string;
    CONTEXTUAL_CONTENT_RELEASE_ROOT: string;
  };
}

export function createContextualContentTestWorkspace(
  purpose = "contextual-content",
): ContextualContentTestWorkspace {
  const root = mkdtempSync(path.join(tmpdir(), `wordranger-${purpose}-`));
  const token = randomUUID();
  const reviewRoot = path.join(root, "reviews");
  const promotionRoot = path.join(root, "promotions");
  const releaseRoot = path.join(root, "releases");
  mkdirSync(reviewRoot);
  mkdirSync(promotionRoot);
  mkdirSync(releaseRoot);
  writeFileSync(
    path.join(root, WORKSPACE_MARKER_NAME),
    `${JSON.stringify(
      {
        kind: CONTEXTUAL_CONTENT_TEST_WORKSPACE_KIND,
        purpose: `${purpose} / SYNTHETIC_TEST_ONLY`,
        token,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
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
