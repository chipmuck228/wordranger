import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const REVIEW_URL = "/debug/contextual-content-review/meal-expansion-batch-01/cup";
const RECORD_PATH = "docs/contextual-content-reviews/meal-expansion-batch-01-cup/human-review.record.json";
const HUMAN_PATH = "docs/contextual-content-reviews/meal-expansion-batch-01-cup/HUMAN_REVIEW.md";
const originalRecord = existsSync(RECORD_PATH) ? readFileSync(RECORD_PATH) : null;
const originalHuman = existsSync(HUMAN_PATH) ? readFileSync(HUMAN_PATH) : null;

test.afterEach(() => {
  if (originalRecord) {
    writeFileSync(RECORD_PATH, originalRecord);
  } else if (existsSync(RECORD_PATH)) {
    unlinkSync(RECORD_PATH);
  }
  if (originalHuman) {
    writeFileSync(HUMAN_PATH, originalHuman);
  }
});

async function studentText(page: Page, stage: string, title?: string): Promise<string> {
  const root = title
    ? page.locator(`[data-review-step="${stage}"][data-review-title="${title}"]`)
    : page.locator(`[data-review-step="${stage}"]`).first();
  const panel = root.locator('[aria-label="学生看到的内容"]');
  return (await panel.innerText()).toLowerCase();
}

test.describe("default host without debug flags", () => {
  test.use({ baseURL: "http://127.0.0.1:3317" });

  test("Homepage has no Debug Lab links and Settings hides Debug tools", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "开始今天的训练" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Vocabulary Debug Lab" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Task Protocol Debug Lab" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Scheduler Debug Lab" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Learning Core Debug Lab" })).toHaveCount(0);
    await page.getByRole("button", { name: "设置" }).click();
    await expect(page.getByRole("heading", { name: "Debug 工具" })).toHaveCount(0);
    const review = await page.goto("/debug/contextual-content-review");
    expect(review?.status()).toBe(404);
  });
});

test.describe("readonly review host", () => {
  test.use({ baseURL: "http://127.0.0.1:3318" });

  test("Settings shows five Debug tools and review pages stay read-only", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "设置" }).click();
    const group = page.getByTestId("debug-tools-group");
    await expect(group).toBeVisible();
    await expect(group.getByRole("link", { name: "词汇调试" })).toHaveAttribute(
      "href",
      "/debug/vocabulary",
    );
    await expect(group.getByRole("link", { name: "任务协议调试" })).toHaveAttribute(
      "href",
      "/debug/tasks",
    );
    await expect(group.getByRole("link", { name: "调度器调试" })).toHaveAttribute(
      "href",
      "/debug/scheduler",
    );
    await expect(group.getByRole("link", { name: "Learning Core 调试" })).toHaveAttribute(
      "href",
      "/debug/learning",
    );
    await expect(group.getByRole("link", { name: "内容审核工具" })).toHaveAttribute(
      "href",
      "/debug/contextual-content-review",
    );

    await page.goto(REVIEW_URL);
    await expect(page.getByText("Candidate / 尚未进入实验")).toBeVisible();
    const reviewRequests: string[] = [];
    page.on("request", (request) => reviewRequests.push(request.url()));
    await expect(page.getByTestId("review-registry-status")).toHaveText("CANDIDATE");
    await expect(page.getByTestId("review-readonly")).toBeVisible();
    await expect(page.getByRole("button", { name: "通过审核" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "需要修改" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "拒绝" })).toBeDisabled();

    const probe = await studentText(page, "PROBE_ACTIVE_RECALL");
    expect(probe.includes("cup")).toBe(false);
    const teach = await studentText(page, "BUILD_TEACH");
    expect(teach).toContain("cup");
    expect(teach).toContain("教学曝光");
    const fade = await studentText(page, "BUILD_FADE");
    expect(fade.split("\n").join(" ")).not.toMatch(/\bcup\b/);
    const recall = await studentText(page, "BUILD_VERIFY", "RECALL");
    expect(recall).not.toContain("cup");

    await page.getByRole("tab", { name: "Restaurant meal" }).click();
    await expect(page.getByLabel("Restaurant meal 场景")).toBeVisible();
    expect(
      reviewRequests.some((url) => {
        try {
          const { pathname } = new URL(url);
          return pathname === "/train" || pathname.startsWith("/train/");
        } catch {
          return false;
        }
      }),
    ).toBe(false);
    expect(reviewRequests.some((url) => url.includes("submitFrozenTask"))).toBe(false);
  });

  test("review pages remain usable at required viewports", async ({ page }) => {
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(REVIEW_URL);
      await expect(page.getByRole("heading", { name: "Candidate / 尚未进入实验" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow, `${viewport.width}x${viewport.height}`).toBe(false);
      await page.keyboard.press("Tab");
    }
  });
});

test.describe("writable review host", () => {
  test.use({ baseURL: "http://127.0.0.1:3319" });

  test("can save 需要修改 and still show CANDIDATE registry status", async ({
    page,
  }) => {
    await page.goto(REVIEW_URL);
    await page.getByRole("button", { name: "需要修改" }).click();
    await page.getByLabel("Required revisions").fill("Tighten contrast copy.");
    await page.getByRole("button", { name: "确认" }).click();
    await expect(page.getByText("已保存人工审核记录。Registry 仍为 CANDIDATE。")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-human-status")).toHaveText("REVISE");
    await expect(page.getByTestId("review-registry-status")).toHaveText("CANDIDATE");
  });

  test("rejects a stale fingerprint from the page", async ({ page }) => {
    await page.goto(REVIEW_URL);
    await page.getByRole("button", { name: "通过审核" }).click();
    await page.getByTestId("review-expected-fingerprint").fill("0".repeat(64));
    await page.getByRole("button", { name: "确认" }).click();
    await expect(page.getByTestId("review-save-message")).toHaveText(
      "The submitted fingerprint does not match current review content.",
    );
    await expect(page.getByTestId("review-registry-status")).toHaveText("CANDIDATE");
  });
});
