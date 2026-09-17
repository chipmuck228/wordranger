import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const homePage = readFileSync(
  path.join(process.cwd(), "src/app/page.tsx"),
  "utf8",
);
const reviewPagePath = path.join(
  process.cwd(),
  "src/app/debug/vocabulary-placement/page.tsx",
);

describe("Placement review tool boundary", () => {
  it("student home does not contain a link to /debug/vocabulary-placement", () => {
    expect(homePage).not.toContain("/debug/vocabulary-placement");
    expect(homePage).not.toContain("Open Vocabulary Placement Review");
    expect(homePage).not.toContain("Vocabulary Placement Review");
  });

  it("internal review route still exists", () => {
    expect(existsSync(reviewPagePath)).toBe(true);
    const reviewPage = readFileSync(reviewPagePath, "utf8");
    expect(reviewPage).toContain("VocabularyPlacementReviewLab");
    expect(reviewPage).toContain('export const dynamic = "force-dynamic"');
  });
});
