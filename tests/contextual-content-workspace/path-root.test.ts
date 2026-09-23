import path from "node:path";
import { describe, expect, it } from "vitest";
import { contextualPromotionRoot, defaultContextualPromotionRoot } from "@/server/contextual-content-promotion/promotion-artifact-path";
import { contextualReleaseRoot, defaultContextualReleaseRoot } from "@/server/contextual-content-release/release-artifact-path";
import { defaultContextualReviewRoot, resolveContextualReviewRoot } from "@/server/contextual-content-review/review-artifact-path";
import { REAL_RELEASE_SERVER_ENV } from "../../e2e/real-release-env";

describe("contextual content file-root injection", () => {
  it("defaults to repository docs roots without env override", () => {
    const env = {};
    expect(resolveContextualReviewRoot(env)).toBe(defaultContextualReviewRoot());
    expect(contextualPromotionRoot(env)).toBe(defaultContextualPromotionRoot());
    expect(contextualReleaseRoot(env)).toBe(defaultContextualReleaseRoot());
  });

  it("relocates roots when test env overrides are set", () => {
    const env = {
      CONTEXTUAL_CONTENT_REVIEW_ROOT: "/tmp/wordranger-review-root",
      CONTEXTUAL_CONTENT_PROMOTION_ROOT: "/tmp/wordranger-promotion-root",
      CONTEXTUAL_CONTENT_RELEASE_ROOT: "/tmp/wordranger-release-root",
    };
    expect(resolveContextualReviewRoot(env)).toBe(path.resolve("/tmp/wordranger-review-root"));
    expect(contextualPromotionRoot(env)).toBe(path.resolve("/tmp/wordranger-promotion-root"));
    expect(contextualReleaseRoot(env)).toBe(path.resolve("/tmp/wordranger-release-root"));
  });

  it("keeps real-release server env write gates closed", () => {
    expect(REAL_RELEASE_SERVER_ENV.CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED).toBe("0");
    expect(REAL_RELEASE_SERVER_ENV.CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED).toBe("0");
    expect(REAL_RELEASE_SERVER_ENV.CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED).toBe("0");
  });
});
