import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const RELEASE_URL = "/debug/contextual-content-release";
const LAB_URL = "/play/context-lab";
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
    await expect(page.getByTestId("release-no-draft").or(page.getByTestId("release-list"))).toBeVisible();
  }
}

async function publishCurrent(page: Page) {
  await page.getByTestId("release-publish").click();
  await page.getByTestId("release-publish-confirm").click();
  await expect(page.getByTestId("release-active-badge")).toBeVisible();
}

test.describe("default host without release flags", () => {
  test.use({ baseURL: "http://127.0.0.1:3317" });

  test("release route is 404 and train stays available", async ({ page }) => {
    const response = await page.goto(RELEASE_URL);
    expect(response?.status()).toBe(404);
    const train = await page.goto("/train");
    expect(train?.ok()).toBeTruthy();
  });
});

test.describe("readonly release host", () => {
  test.use({ baseURL: "http://127.0.0.1:3318" });

  test("can view the six-word page and cannot write", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "设置" }).click();
    await expect(page.getByRole("link", { name: "内容发布工具" })).toHaveAttribute(
      "href",
      RELEASE_URL,
    );
    await page.goto(RELEASE_URL);
    await expect(page.getByRole("heading", { name: "内容发布工具" })).toBeVisible();
    await expect(page.getByTestId("release-phase-notice")).toContainText("Experimental Context Lab");
    await expect(page.getByTestId("release-content-source")).toHaveText("static");
    await expect(page.getByTestId("release-current-pack")).toHaveText("meal-scene-expansion-batch-02");
    await expect(page.getByTestId("release-live-targets").locator("li")).toHaveCount(6);
    await expect(page.getByRole("button", { name: "创建迁移 Draft" })).toBeDisabled();
    await expect(page.getByTestId("release-readonly")).toBeVisible();
  });
});

test.describe("writable release host with active-release Context Lab", () => {
  test.use({ baseURL: "http://127.0.0.1:3319" });

  test.afterEach(async ({ page }) => {
    await page.goto(RELEASE_URL);
    await discardIfPresent(page);
    expect(readFileSync(CUP_RECORD, "utf8")).toBe(cupBefore);
    expect(readFileSync(PLATE_RECORD, "utf8")).toBe(plateBefore);
  });

  test("preflight publish becomes active and Context Lab uses that release", async ({ page }) => {
    restoreReviewRecords();
    await page.goto(RELEASE_URL);
    await discardIfPresent(page);
    await page.getByRole("button", { name: "创建迁移 Draft" }).click();
    await expect(page.getByTestId("release-status")).toHaveText("DRAFT");
    await page.getByRole("button", { name: "运行 Preflight" }).click();
    await expect(page.getByTestId("release-preflight-status")).toHaveText("PASS");
    await expect(page.getByTestId("release-status")).toHaveText("PREFLIGHT_VALIDATED");
    await publishCurrent(page);
    await expect(page.getByTestId("release-status")).toHaveText("PUBLISHED");
    const releaseId = (await page.getByTestId("release-id").textContent())?.trim();
    expect(releaseId).toBeTruthy();
    await page.goto(LAB_URL);
    await expect(page.getByTestId("context-lab-content-pin")).toHaveText(releaseId!);
    await expect(page.getByRole("heading", { name: /早餐/ })).toBeVisible();
  });

  test("an old run stays pinned after a newer publish", async ({ page, context }) => {
    restoreReviewRecords();
    await page.goto(RELEASE_URL);
    await discardIfPresent(page);
    await page.getByRole("button", { name: "创建迁移 Draft" }).click();
    await page.getByRole("button", { name: "运行 Preflight" }).click();
    await expect(page.getByTestId("release-status")).toHaveText("PREFLIGHT_VALIDATED");
    await publishCurrent(page);
    const firstId = (await page.getByTestId("release-id").textContent())?.trim();
    const lab = await context.newPage();
    await lab.goto(LAB_URL);
    await expect(lab.getByTestId("context-lab-content-pin")).toHaveText(firstId!);
    await page.getByRole("button", { name: "创建迁移 Draft" }).click();
    await page.getByRole("button", { name: "运行 Preflight" }).click();
    await expect(page.getByTestId("release-publish")).toBeVisible();
    await publishCurrent(page);
    const secondId = (await page.locator("[data-testid^='release-card-']").last().locator("dd").first().textContent())?.trim();
    await expect(lab.getByTestId("context-lab-content-pin")).toHaveText(firstId!);
    const fresh = await context.newPage();
    await fresh.goto(LAB_URL);
    await expect(fresh.getByTestId("context-lab-content-pin")).not.toHaveText(firstId!);
    await lab.close();
    await fresh.close();
    expect(secondId).toBeTruthy();
  });

  test("rollback and stale double-click stay fail-closed", async ({ page }) => {
    restoreReviewRecords();
    await page.goto(RELEASE_URL);
    await discardIfPresent(page);
    await page.getByRole("button", { name: "创建迁移 Draft" }).click();
    await page.getByRole("button", { name: "运行 Preflight" }).click();
    await publishCurrent(page);
    const firstId = (await page.getByTestId("release-id").textContent())?.trim();
    await page.getByRole("button", { name: "创建迁移 Draft" }).click();
    await page.getByRole("button", { name: "运行 Preflight" }).click();
    await publishCurrent(page);
    const rollback = page.locator(`[data-testid='release-rollback-${firstId}']`);
    await expect(rollback).toBeVisible();
    await rollback.click();
    await page.getByTestId("release-rollback-confirm").dblclick();
    await expect(page.getByTestId(`release-active-${firstId}`)).toHaveText("ACTIVE");
    await page.getByTestId("release-publish").waitFor({ state: "detached" }).catch(() => undefined);
  });

  test("stale revision does not publish twice", async ({ page, context }) => {
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
    await other.close();
  });
});
