import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const RELEASE_URL = "/debug/contextual-content-release";
const CUP_RECORD = "docs/contextual-content-reviews/meal-expansion-batch-01-cup/human-review.record.json";
const PLATE_RECORD = "docs/contextual-content-reviews/meal-expansion-batch-02-plate/human-review.record.json";
const cupBefore = readFileSync(CUP_RECORD, "utf8");
const plateBefore = readFileSync(PLATE_RECORD, "utf8");

function restoreReviewRecords() {
  writeFileSync(CUP_RECORD, cupBefore);
  writeFileSync(PLATE_RECORD, plateBefore);
}

async function discardIfPresent(page: Page) {
  const discard = page.getByRole("button", { name: "放弃本地 Draft" });
  if (await discard.isEnabled()) {
    await discard.click();
    await expect(page.getByTestId("release-no-draft")).toBeVisible();
  }
}

test.describe("default host without release flags", () => {
  test.use({ baseURL: "http://127.0.0.1:3317" });

  test("release route is 404", async ({ page }) => {
    const response = await page.goto(RELEASE_URL);
    expect(response?.status()).toBe(404);
  });
});

test.describe("readonly release host", () => {
  test.use({ baseURL: "http://127.0.0.1:3318" });

  test("can view the six-word dry-run page and cannot write", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "设置" }).click();
    await expect(page.getByRole("link", { name: "内容发布工具" })).toHaveAttribute(
      "href",
      RELEASE_URL,
    );
    await page.goto(RELEASE_URL);
    await expect(page.getByRole("heading", { name: "内容发布工具" })).toBeVisible();
    await expect(page.getByTestId("release-phase-notice")).toHaveText(
      "本阶段只验证发布快照，不会切换 Context Lab。",
    );
    await expect(page.getByTestId("release-current-pack")).toHaveText("meal-scene-expansion-batch-02");
    await expect(page.getByTestId("release-live-targets").locator("li")).toHaveCount(6);
    await expect(page.getByRole("button", { name: "创建迁移 Draft" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "运行 Preflight" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
    await expect(page.getByTestId("release-readonly")).toBeVisible();
  });
});

test.describe("writable release host", () => {
  test.use({ baseURL: "http://127.0.0.1:3319" });

  test.afterEach(async ({ page }) => {
    await page.goto(RELEASE_URL);
    await discardIfPresent(page);
    expect(readFileSync(CUP_RECORD, "utf8")).toBe(cupBefore);
    expect(readFileSync(PLATE_RECORD, "utf8")).toBe(plateBefore);
  });

  test("creates one migration draft and preflights without publishing", async ({ page }) => {
    restoreReviewRecords();
    await page.goto(RELEASE_URL);
    await discardIfPresent(page);
    await page.getByRole("button", { name: "创建迁移 Draft" }).click();
    await page.getByRole("button", { name: "创建迁移 Draft" }).click();
    await expect(page.getByTestId("release-id")).toHaveText("meal-release-migration-v0");
    await expect(page.getByTestId("release-status")).toHaveText("DRAFT");
    await expect(page.getByTestId("release-target-count")).toHaveText("6");
    await expect(page.getByTestId("release-draft-targets").locator("li")).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
    await page.getByRole("button", { name: "运行 Preflight" }).click();
    await expect(page.getByTestId("release-preflight-status")).toHaveText("PASS");
    await expect(page.getByTestId("release-status")).toHaveText("PREFLIGHT_VALIDATED");
    await expect(page.getByTestId("release-phase-notice")).toHaveText(
      "本阶段只验证发布快照，不会切换 Context Lab。",
    );
  });

  test("stale revision refreshes instead of publishing a second release", async ({
    page,
    context,
  }) => {
    restoreReviewRecords();
    await page.goto(RELEASE_URL);
    await discardIfPresent(page);
    await page.getByRole("button", { name: "创建迁移 Draft" }).click();
    await expect(page.getByTestId("release-status")).toHaveText("DRAFT");
    const other = await context.newPage();
    await other.goto(RELEASE_URL);
    await other.getByRole("button", { name: "运行 Preflight" }).click();
    await expect(other.getByTestId("release-status")).toHaveText("PREFLIGHT_VALIDATED");
    await page.getByRole("button", { name: "运行 Preflight" }).click();
    await expect(page.getByTestId("release-action-message")).toContainText(
      "Another release write happened first.",
    );
    await page.getByRole("button", { name: "刷新" }).click();
    await expect(page.getByTestId("release-status")).toHaveText("PREFLIGHT_VALIDATED");
    await expect(page.getByTestId("release-id")).toHaveText("meal-release-migration-v0");
    await other.close();
  });

  test("three viewports stay usable without horizontal overflow", async ({ page }) => {
    await page.goto(RELEASE_URL);
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.getByRole("heading", { name: "内容发布工具" })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow, `${viewport.width}x${viewport.height}`).toBe(false);
      await page.keyboard.press("Tab");
    }
  });
});
