import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CONTENT_REVIEW_TARGETS } from "../src/server/contextual-content-review/review-target-registry";
import {
  HUMAN_WORKSPACE_PATHS,
  SYNTHETIC_TEST_NOTE,
  seedOrdinaryE2EFixtures,
  seedSyntheticApprovedReviews,
  snapshotHumanArtifact,
  workspacePromotionPath,
  workspaceReviewRecordPath,
} from "../tests/contextual-content-workspace";
import { ordinaryE2EWorkspace } from "./ordinary-contextual-workspace";

const REVIEW_URL = "/debug/contextual-content-review/meal-expansion-batch-01/cup";

function workspace() {
  return ordinaryE2EWorkspace();
}

test.afterEach(() => {
  seedOrdinaryE2EFixtures(workspace());
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
    await expect(page.getByRole("link", { name: "开始自由练习" })).toBeVisible();
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

const PLATE_REVIEW_URL = "/debug/contextual-content-review/meal-expansion-batch-02/plate";

test.describe("readonly review host", () => {
  test.use({ baseURL: "http://127.0.0.1:3318" });

  test("Settings shows six Debug tools and review pages stay read-only", async ({
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
    await expect(group.getByRole("link", { name: "内容发布工具" })).toHaveAttribute(
      "href",
      "/debug/contextual-content-release",
    );

    await page.goto("/debug/contextual-content-review");
    await expect(page.getByTestId("review-batch-meal-expansion-batch-01")).toBeVisible();
    await expect(page.getByTestId("review-batch-meal-expansion-batch-02")).toBeVisible();
    await expect(page.getByTestId("review-batch-meal-expansion-batch-03")).toBeVisible();
    await expect(page.getByTestId("meal-expansion-batch-03-total")).toHaveText("3");
    await expect(page.getByTestId("meal-expansion-batch-03-pending")).toHaveText("3");
    await expect(page.getByTestId("meal-expansion-batch-03-approved")).toHaveText("0");
    await expect(page.getByTestId("meal-expansion-batch-03-rejected")).toHaveText("0");
    await expect(page.getByTestId("meal-expansion-batch-03-stale")).toHaveText("0");
    await expect(page.getByTestId("meal-expansion-batch-03-blocked")).toHaveText("1");
    await expect(page.getByTestId("review-blocked-napkin")).toContainText("BLOCKED");
    await expect(page.getByRole("button", { name: "全部通过" })).toHaveCount(0);
    await expect(page.getByTestId("review-card-meal-expansion-batch-01-cup")).toContainText("Status: APPROVED");
    await expect(page.getByTestId("review-card-meal-expansion-batch-02-plate")).toContainText("Status: APPROVED");
    await expect(page.getByTestId("review-card-meal-expansion-batch-03-knife")).toContainText("Status: PENDING");
    await expect(page.getByTestId("review-card-meal-expansion-batch-03-bread")).toContainText("Status: PENDING");
    await expect(page.getByTestId("review-card-meal-expansion-batch-03-water")).toContainText("Status: PENDING");
    await expect(page.getByTestId("review-card-meal-expansion-batch-03-knife")).toContainText("Registry: CANDIDATE");
    await expect(page.getByTestId("promote-reviewed-batch")).toHaveCount(0);
    await expect(page.getByTestId("meal-expansion-batch-03-promotion-blocked")).toBeVisible();
    await expect(page.getByText("PROMOTION_REVIEW_PENDING").first()).toBeVisible();
    await expect(
      page.getByTestId("review-batch-meal-expansion-batch-03").getByText("Promotion: NONE"),
    ).toBeVisible();

    await page.goto(REVIEW_URL);
    await expect(page.getByText("Candidate V0 / 已进入实验 Context Lab")).toBeVisible();
    const reviewRequests: string[] = [];
    page.on("request", (request) => reviewRequests.push(request.url()));
    await expect(page.getByTestId("review-human-status")).toHaveText("APPROVED");
    await expect(page.getByTestId("review-stale-state")).toHaveText("CURRENT");
    await expect(page.getByTestId("review-registry-status")).toHaveText("APPROVED_FOR_EXPERIMENT");
    await expect(page.getByTestId("review-experiment-notice")).toHaveText(
      "已进入实验 Context Lab，不代表 Standard 或生产批准",
    );
    await expect(page.getByTestId("review-promotion-scope")).toContainText("EXPERIMENT_ONLY");
    await expect(page.getByTestId("review-revision")).toHaveText("1");
    await expect(page.getByTestId("review-fingerprint")).toHaveText(
      "51dc51dc1a321f2af03126d75db1823e59eed61f7e3168c47f4b360611997a40",
    );
    await expect(page.getByText("Standard approved")).toHaveCount(0);
    await expect(page.getByText("production approval")).toHaveCount(0);
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

    await page.goto(PLATE_REVIEW_URL);
    await expect(page.getByText("Candidate V0 / 已进入实验 Context Lab")).toBeVisible();
    await expect(page.getByTestId("review-human-status")).toHaveText("APPROVED");
    await expect(page.getByTestId("review-registry-status")).toHaveText("APPROVED_FOR_EXPERIMENT");
    await expect(page.getByTestId("review-experiment-notice")).toHaveText(
      "已进入实验 Context Lab，不代表 Standard 或生产批准",
    );
    await expect(page.getByTestId("review-promotion-scope")).toContainText("EXPERIMENT_ONLY");
    await expect(page.getByTestId("review-revision")).toHaveText("1");
    await expect(page.getByTestId("review-fingerprint")).toHaveText(
      "4ce843238a0b5b4ca570b335e75ed2549b9af94acf536144812ecc1c86ed032b",
    );
    await expect(page.locator("input[data-testid='review-fingerprint']")).toHaveCount(0);
    await expect(page.getByText("机器验证通过不等于人工批准")).toBeVisible();
    await expect(page.getByText("plate#food-support")).toBeVisible();
    await expect(page.getByTestId("review-meaning-gloss")).toHaveText("盘子");
    await expect(page.getByText("板", { exact: true })).toHaveCount(0);
    const unknown = await page.goto("/debug/contextual-content-review/missing-pack/plate");
    expect(unknown?.status()).toBe(404);

    await page.goto("/debug/contextual-content-review/meal-expansion-batch-03/knife");
    await expect(page.getByText("Candidate / 尚未进入实验")).toBeVisible();
    await expect(page.getByTestId("review-human-status")).toHaveText("PENDING");
    await expect(page.getByTestId("review-registry-status")).toHaveText("CANDIDATE");
    await expect(page.getByTestId("review-meaning-gloss")).toHaveText("小刀");
    await expect(page.getByTestId("review-ipa")).toContainText("naɪf");
    await expect(page.getByTestId("review-promotion-scope")).toHaveCount(0);

    await page.goto("/play/context-lab");
    await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
    await expect(page.getByText("meal-scene-expansion-batch-03")).toHaveCount(0);
    await expect(page.getByText("knife(pl.knives)", { exact: true })).toHaveCount(0);
    await expect(page.getByText("napkin", { exact: true })).toHaveCount(0);

    await page.goto("/train");
    await expect(page).not.toHaveURL(/debug/);
    await expect(page.getByText("Meal Expansion Batch 03")).toHaveCount(0);
  });

  test("review pages remain usable at required viewports", async ({ page }) => {
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/debug/contextual-content-review");
      await expect(page.getByTestId("review-batch-meal-expansion-batch-03")).toBeVisible();
      await expect(page.getByTestId("review-card-meal-expansion-batch-03-knife")).toBeVisible();
      let overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow, `batch ${viewport.width}x${viewport.height}`).toBe(false);
      await page.keyboard.press("Tab");
      await page.goto("/debug/contextual-content-review/meal-expansion-batch-03/knife");
      await expect(page.getByRole("heading", { name: "Candidate / 尚未进入实验" })).toBeVisible();
      overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow, `knife ${viewport.width}x${viewport.height}`).toBe(false);
      await page.goto(REVIEW_URL);
      await expect(page.getByRole("heading", { name: "Candidate V0 / 已进入实验 Context Lab" })).toBeVisible();
      overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow, `${viewport.width}x${viewport.height}`).toBe(false);
      await page.keyboard.press("Tab");
    }
  });

  test("hides promotion writes while review pages stay independently readable", async ({
    page,
  }) => {
    seedSyntheticApprovedReviews(workspace(), ["knife", "bread", "water"]);
    await page.goto("/debug/contextual-content-review");
    await expect(page.getByTestId("review-batch-meal-expansion-batch-03")).toBeVisible();
    await expect(page.getByTestId("meal-expansion-batch-03-approved")).toHaveText("3");
    await expect(page.getByTestId("promote-reviewed-batch")).toBeDisabled();
    await expect(page.getByText("CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED=1")).toBeVisible();
    await page.goto("/debug/contextual-content-review/meal-expansion-batch-03/knife");
    await expect(page.getByTestId("review-human-status")).toHaveText("APPROVED");
    await expect(page.getByRole("button", { name: "通过审核" })).toBeDisabled();
    expect(existsSync(workspacePromotionPath(workspace()))).toBe(false);
  });
});

test.describe("writable review host", () => {
  test.use({ baseURL: "http://127.0.0.1:3319" });

  test("can save 需要修改 without changing the experiment registry status", async ({
    page,
  }) => {
    await page.goto(REVIEW_URL);
    await page.getByRole("button", { name: "需要修改" }).click();
    await page.getByLabel("Required revisions").fill("Tighten contrast copy.");
    await page.getByRole("button", { name: "确认" }).click();
    await expect(page.getByText("已保存人工审核记录。不会修改 registry 或 promotion。")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-human-status")).toHaveText("REVISE");
    await expect(page.getByTestId("review-registry-status")).toHaveText("APPROVED_FOR_EXPERIMENT");
  });

  test("rejects a conflicting decision and refreshes the current review record", async ({
    page,
  }) => {
    await page.goto(REVIEW_URL);
    const pageRevision = Number((await page.getByTestId("review-revision").innerText()).trim());
    expect(Number.isInteger(pageRevision) && pageRevision >= 0).toBe(true);
    const fingerprint = (await page.getByTestId("review-fingerprint").innerText()).trim();
    const cupSpec = CONTENT_REVIEW_TARGETS.find(
      (item) => item.reviewKey === "meal-expansion-batch-01-cup",
    )!;
    writeFileSync(
      workspaceReviewRecordPath(workspace(), "meal-expansion-batch-01-cup"),
      `${JSON.stringify(
        {
          schemaVersion: "candidate-v0",
          reviewKey: "meal-expansion-batch-01-cup",
          packId: "meal-scene-expansion-batch-01",
          target: cupSpec.target,
          contentFingerprint: fingerprint,
          decision: "APPROVED",
          notes: [SYNTHETIC_TEST_NOTE],
          reviewedAt: "2026-09-21T00:00:00.000Z",
          revision: pageRevision + 1,
          reviewer: "LOCAL_INTERNAL_REVIEWER",
        },
        null,
        2,
      )}\n`,
    );
    await page.getByRole("button", { name: "拒绝" }).click();
    await page.getByLabel("拒绝理由").fill("Not ready.");
    await page.getByRole("button", { name: "确认" }).click();
    await expect(page.getByTestId("review-save-message")).toHaveText(
      "Another review decision was saved first.",
    );
    await expect(page.getByTestId("review-human-status")).toHaveText("APPROVED");
    await expect(page.getByTestId("review-revision")).toHaveText(String(pageRevision + 1));
    await expect(page.getByTestId("review-registry-status")).toHaveText("APPROVED_FOR_EXPERIMENT");
  });

  test("approves one batch-03 target and rejects another without promoting the pack", async ({
    page,
  }) => {
    await page.goto("/debug/contextual-content-review/meal-expansion-batch-03/knife");
    await expect(page.getByTestId("review-human-status")).toHaveText("PENDING");
    await page.getByRole("button", { name: "通过审核" }).click();
    await expect(page.getByTestId("review-confirm-fingerprint")).toBeVisible();
    await page.getByTestId("review-confirm").click();
    await expect(page.getByText("已保存人工审核记录。不会修改 registry 或 promotion。")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-human-status")).toHaveText("APPROVED");
    await expect(page.getByTestId("review-registry-status")).toHaveText("CANDIDATE");

    await page.goto("/debug/contextual-content-review/meal-expansion-batch-03/bread");
    await expect(page.getByTestId("review-human-status")).toHaveText("PENDING");
    await page.getByRole("button", { name: "拒绝" }).click();
    await page.getByLabel("拒绝理由").fill("Needs a sharper food-state contrast.");
    await page.getByTestId("review-confirm").click();
    await expect(page.getByText("已保存人工审核记录。不会修改 registry 或 promotion。")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-human-status")).toHaveText("REJECTED");
    await expect(page.getByTestId("review-registry-status")).toHaveText("CANDIDATE");

    await page.goto("/debug/contextual-content-review");
    await expect(page.getByTestId("meal-expansion-batch-03-approved")).toHaveText("1");
    await expect(page.getByTestId("meal-expansion-batch-03-rejected")).toHaveText("1");
    await expect(page.getByTestId("meal-expansion-batch-03-pending")).toHaveText("1");
    await expect(page.getByTestId("meal-expansion-batch-03-unpromoted")).toHaveCount(0);
    await expect(page.getByTestId("promote-reviewed-batch")).toHaveCount(0);
  });

  test("promotes a fully approved batch once and keeps Context Lab on six words", async ({
    page,
  }) => {
    const realPromotionBefore = snapshotHumanArtifact(HUMAN_WORKSPACE_PATHS.batch03Promotion);
    seedSyntheticApprovedReviews(workspace(), ["knife", "bread", "water"]);
    await page.goto("/debug/contextual-content-review");
    await expect(page.getByTestId("meal-expansion-batch-03-approved")).toHaveText("3");
    await expect(page.getByTestId("meal-expansion-batch-03-pending")).toHaveText("0");
    await expect(page.getByTestId("review-blocked-napkin")).toContainText("BLOCKED");
    await expect(page.getByTestId("promote-reviewed-batch")).toBeVisible();
    await page.getByTestId("promote-reviewed-batch").click();
    await expect(page.getByTestId("promote-confirm")).toBeVisible();
    await expect(page.getByText("不会立即发布到 Context Lab")).toBeVisible();
    await expect(page.getByText("不会进入 /train")).toBeVisible();
    await page.getByTestId("promote-confirm").dblclick();
    await expect(page.getByTestId("promote-save-message")).toContainText("Batch promotion 已保存");
    await expect(page.getByTestId("promote-confirm")).toHaveCount(0);
    await expect(page.getByText("Promotion: PROMOTED")).toBeVisible();
    const savedPromotion = JSON.parse(readFileSync(workspacePromotionPath(workspace()), "utf8")) as {
      packFingerprint: string;
      promotedBy: string;
    };
    expect(savedPromotion.packFingerprint).not.toBe("stale-pack");
    expect(savedPromotion.promotedBy).toBe("LOCAL_INTERNAL_PROMOTER");
    expect(snapshotHumanArtifact(HUMAN_WORKSPACE_PATHS.batch03Promotion)).toEqual(
      realPromotionBefore,
    );

    await page.goto("/debug/contextual-content-release");
    await expect(page.getByTestId("release-eligible-pack")).toHaveText("meal-scene-expansion-batch-03");
    await expect(page.getByTestId("release-eligible-target-count")).toHaveText("9");
    await expect(page.getByTestId("release-live-targets").locator("li")).toHaveCount(9);
    await expect(page.getByTestId("release-unpromoted-candidates")).toHaveCount(0);

    await page.goto("/play/context-lab");
    await expect(page.getByText("meal-scene-expansion-batch-03")).toHaveCount(0);
    await expect(page.getByText("knife(pl.knives)", { exact: true })).toHaveCount(0);
    await expect(page.getByText("napkin", { exact: true })).toHaveCount(0);
  });

  test("marks a stale batch-03 review after the stored fingerprint drifts", async ({ page }) => {
    await page.goto("/debug/contextual-content-review/meal-expansion-batch-03/water");
    const fingerprint = (await page.getByTestId("review-fingerprint").innerText()).trim();
    const stalePath = workspaceReviewRecordPath(
      workspace(),
      "meal-expansion-batch-03-water",
    );
    mkdirSync(path.dirname(stalePath), { recursive: true });
    writeFileSync(
      stalePath,
      `${JSON.stringify(
        {
          schemaVersion: "candidate-v0",
          reviewKey: "meal-expansion-batch-03-water",
          packId: "meal-scene-expansion-batch-03",
          target: { lexemeId: "stale", senseId: "water#drinkable-liquid" },
          contentFingerprint: `stale-${fingerprint}`,
          decision: "APPROVED",
          notes: [SYNTHETIC_TEST_NOTE],
          reviewedAt: "2026-09-22T00:00:00.000Z",
          revision: 1,
          reviewer: "LOCAL_INTERNAL_REVIEWER",
        },
        null,
        2,
      )}\n`,
    );
    await page.reload();
    await expect(page.getByTestId("review-stale-state")).toHaveText("STALE_REVIEW");
    await expect(page.getByTestId("review-human-status")).toHaveText("PENDING");
    await expect(page.getByTestId("review-registry-status")).toHaveText("CANDIDATE");
  });
});
