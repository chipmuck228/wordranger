import { expect, test, type Page } from "@playwright/test";

function wrappedDelta(from: number, to: number, size: number): number {
  const raw = to - from;
  const wrap = raw > 0 ? raw - size : raw + size;
  return Math.abs(wrap) < Math.abs(raw) ? wrap : raw;
}

async function steerToFirstOption(page: Page): Promise<void> {
  const option = page.locator("[data-option-id]").first();
  await expect(option).toBeVisible();
  const ox = Number(await option.getAttribute("data-cell-x"));
  const oy = Number(await option.getAttribute("data-cell-y"));
  let last = "RIGHT";
  for (let step = 0; step < 80; step += 1) {
    if (await page.getByRole("button", { name: "继续" }).isVisible()) {
      return;
    }
    const board = page.getByRole("application", { name: "贪食蛇棋盘" });
    const hx = Number(await board.getAttribute("data-head-x"));
    const hy = Number(await board.getAttribute("data-head-y"));
    const dx = wrappedDelta(hx, ox, 12);
    const dy = wrappedDelta(hy, oy, 16);
    let want =
      dy !== 0 ? (dy > 0 ? "向下" : "向上") : dx !== 0 ? (dx > 0 ? "向右" : "向左") : null;
    const opposite =
      (last === "RIGHT" && want === "向左") ||
      (last === "LEFT" && want === "向右") ||
      (last === "UP" && want === "向下") ||
      (last === "DOWN" && want === "向上");
    if (!want || opposite) {
      want = want === "向左" || want === "向右" ? "向上" : "向右";
    }
    const control = page.getByRole("button", { name: want });
    if ((await control.count()) === 0) {
      if (await page.getByRole("button", { name: "继续" }).isVisible()) {
        return;
      }
      break;
    }
    if (!(await control.isEnabled())) {
      await expect(page.getByRole("button", { name: "继续" })).toBeVisible({
        timeout: 15_000,
      });
      return;
    }
    try {
      await control.click({ timeout: 2_000 });
    } catch {
      await expect(page.getByRole("button", { name: "继续" })).toBeVisible({
        timeout: 15_000,
      });
      return;
    }
    last =
      want === "向上" ? "UP" : want === "向下" ? "DOWN" : want === "向左" ? "LEFT" : "RIGHT";
    await page.waitForTimeout(50);
  }
  await expect(page.getByRole("button", { name: "继续" })).toBeVisible({
    timeout: 20_000,
  });
}

async function answerCurrentItem(page: Page): Promise<void> {
  if (await page.getByRole("button", { name: "继续" }).isVisible()) {
    return;
  }
  const bubbles = page.getByRole("group", { name: "单词泡泡" }).getByRole("button");
  if ((await bubbles.count()) > 0) {
    await bubbles.first().click();
    return;
  }
  const target = page.getByRole("button", { name: /^目标：/ });
  if ((await target.count()) > 0) {
    await target.click();
    await page.getByRole("group", { name: "候选" }).getByRole("button").first().click();
    return;
  }
  if ((await page.getByRole("application", { name: "贪食蛇棋盘" }).count()) > 0) {
    await steerToFirstOption(page);
    return;
  }
  const options = page.getByRole("group", { name: "选项" }).getByRole("button");
  if ((await options.count()) > 0) {
    await options.first().click();
    return;
  }
  const submit = page.getByRole("button", { name: "提交" });
  if (await submit.isVisible()) {
    await page.getByLabel("英文答案").fill("word");
    await submit.click();
  }
}

async function startDailyTraining(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: "开始今天的训练" }).click();
  await expect(page).toHaveURL(/\/train/);
  await page.getByRole("button", { name: "开始" }).click();
  await expect(page.locator("[data-renderer]")).toBeVisible({ timeout: 30_000 });
}

test("Home → Daily Training start → answer → feedback → continue", async ({
  page,
}) => {
  await startDailyTraining(page);
  await expect(page.getByText("1 / 8")).toBeVisible();
  await answerCurrentItem(page);
  const continueButton = page.getByRole("button", { name: "继续" });
  await expect(continueButton).toBeVisible({ timeout: 30_000 });
  await continueButton.click();
  await expect(
    page
      .getByRole("heading", { name: "这一轮完成" })
      .or(page.locator("[data-renderer]")),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("2 / 8").or(page.getByText("这一轮完成"))).toBeVisible();
});

test("Daily Training reload resumes the same round from server sessionId", async ({
  page,
}) => {
  // Playwright uses GAME_RUNTIME=memory. This checks client resume needs only
  // sessionId, not a word index. Learner-model persistence is the Supabase test.
  await startDailyTraining(page);
  await expect(page.getByText("1 / 8")).toBeVisible();
  await answerCurrentItem(page);
  await expect(page.getByRole("button", { name: "继续" })).toBeVisible({
    timeout: 30_000,
  });
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: "继续" })
      .or(page.locator("[data-renderer]")),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("1 / 8")).toBeVisible();
  if (await page.getByRole("button", { name: "继续" }).isVisible()) {
    await page.getByRole("button", { name: "继续" }).click();
  }
  await expect(
    page
      .getByRole("heading", { name: "这一轮完成" })
      .or(page.locator("[data-renderer]")),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("2 / 8").or(page.getByText("这一轮完成"))).toBeVisible();
});

test("Daily Training shows more than one renderer without leaving /train", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/train?tickMs=40");
  await page.getByRole("button", { name: "开始" }).click();
  await expect(page.locator("[data-renderer]")).toBeVisible({ timeout: 30_000 });
  const seen = new Set<string>();
  for (let round = 0; round < 6; round += 1) {
    if (await page.getByRole("heading", { name: "这一轮完成" }).isVisible()) {
      break;
    }
    const renderer = await page.locator("[data-renderer]").getAttribute("data-renderer");
    if (renderer) {
      seen.add(renderer);
    }
    await answerCurrentItem(page);
    const continueButton = page.getByRole("button", { name: "继续" });
    await expect(continueButton).toBeVisible({ timeout: 30_000 });
    await continueButton.click();
    await expect(
      page
        .getByRole("heading", { name: "这一轮完成" })
        .or(page.locator("[data-renderer]")),
    ).toBeVisible({ timeout: 30_000 });
    if (seen.size >= 2) {
      break;
    }
  }
  expect(seen.size).toBeGreaterThanOrEqual(2);
  expect(page.url()).toMatch(/\/train/);
});

test("Daily Training can complete an 8-item round", async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/train?tickMs=40");
  await page.getByRole("button", { name: "开始" }).click();
  await expect(page.locator("[data-renderer]")).toBeVisible({ timeout: 30_000 });

  for (let round = 0; round < 8; round += 1) {
    if (await page.getByRole("heading", { name: "这一轮完成" }).isVisible()) {
      break;
    }
    await answerCurrentItem(page);
    const continueButton = page.getByRole("button", { name: "继续" });
    await expect(continueButton).toBeVisible({ timeout: 30_000 });
    await continueButton.click();
    await expect(
      page
        .getByRole("heading", { name: "这一轮完成" })
        .or(page.locator("[data-renderer]")),
    ).toBeVisible({ timeout: 30_000 });
  }

  await expect(page.getByRole("heading", { name: "这一轮完成" })).toBeVisible();
  await expect(page.getByText("完成 8 个")).toBeVisible();
});
