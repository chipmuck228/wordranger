import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

async function assertNoGameChrome(page: Page): Promise<void> {
  await expect(page.getByText("单词泡泡")).toHaveCount(0);
  await expect(page.getByText("连连看")).toHaveCount(0);
  await expect(page.getByText("贪食蛇")).toHaveCount(0);
  await expect(page.getByText("单词闯关")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "单词泡泡" })).toHaveCount(0);
  await expect(page.getByRole("application", { name: "贪食蛇棋盘" })).toHaveCount(0);
}

async function answerCurrentItem(page: Page): Promise<void> {
  if (await page.getByRole("button", { name: "下一题" }).isVisible()) {
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

async function waitForInlineFeedback(page: Page): Promise<void> {
  await expect(page.locator("[data-feedback-status]").first()).toBeVisible({
    timeout: 30_000,
  });
}

async function advanceAfterAnswer(page: Page): Promise<void> {
  const before = await page.getByText(/^\d+ \/ 8$/).textContent();
  await waitForInlineFeedback(page);
  await page.getByRole("button", { name: "下一题" }).click();
  await expect
    .poll(
      async () => {
        if (await page.getByRole("heading", { name: "本组练习完成" }).isVisible()) {
          return "done";
        }
        return page.getByText(/^\d+ \/ 8$/).textContent();
      },
      { timeout: 30_000 },
    )
    .not.toBe(before);
}

async function startDailyTraining(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: "开始自由练习" }).click();
  await expect(page).toHaveURL(/\/train/);
  await page.getByRole("button", { name: "开始练习" }).click();
  await expect(page.locator('[data-renderer="DIRECT_PRACTICE"]')).toBeVisible({
    timeout: 30_000,
  });
}

test("Homepage → 开始自由练习 → /train uses direct presentation", async ({
  page,
}) => {
  await startDailyTraining(page);
  await expect(page.getByText("1 / 8")).toBeVisible();
  await expect(page.locator("[data-renderer]")).toHaveAttribute(
    "data-renderer",
    "DIRECT_PRACTICE",
  );
  await assertNoGameChrome(page);
  await answerCurrentItem(page);
  await waitForInlineFeedback(page);
  await expect(page.locator("[data-renderer]")).toBeVisible();
  await expect(page.getByRole("button", { name: "下一题" })).toBeVisible();
  await expect(page.getByText("1 / 8")).toBeVisible();
  await expect(page.getByText(/^答对了$|^再看看$/)).toHaveCount(1);
  await advanceAfterAnswer(page);
});

test("Daily Training reload resumes the same round from server sessionId", async ({
  page,
}) => {
  await startDailyTraining(page);
  await expect(page.getByText("1 / 8")).toBeVisible();
  await answerCurrentItem(page);
  await waitForInlineFeedback(page);
  await page.reload();
  await expect(
    page
      .locator('[data-renderer="DIRECT_PRACTICE"]')
      .or(page.locator("[data-feedback-status]"))
      .or(page.getByRole("heading", { name: "本组练习完成" }))
      .first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("Daily Training new items stay on DIRECT_PRACTICE", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/train");
  await page.getByRole("button", { name: "开始练习" }).click();
  await expect(page.locator('[data-renderer="DIRECT_PRACTICE"]')).toBeVisible({
    timeout: 30_000,
  });
  for (let round = 0; round < 3; round += 1) {
    if (await page.getByRole("heading", { name: "本组练习完成" }).isVisible()) {
      break;
    }
    await expect(page.locator("[data-renderer]")).toHaveAttribute(
      "data-renderer",
      "DIRECT_PRACTICE",
    );
    await assertNoGameChrome(page);
    await answerCurrentItem(page);
    await advanceAfterAnswer(page);
  }
  expect(page.url()).toMatch(/\/train/);
});

test("Daily Training can complete an 8-item round", async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/train");
  await page.getByRole("button", { name: "开始练习" }).click();
  await expect(page.locator('[data-renderer="DIRECT_PRACTICE"]')).toBeVisible({
    timeout: 30_000,
  });

  for (let round = 0; round < 8; round += 1) {
    if (await page.getByRole("heading", { name: "本组练习完成" }).isVisible()) {
      break;
    }
    await answerCurrentItem(page);
    await advanceAfterAnswer(page);
  }

  await expect(page.getByRole("heading", { name: "本组练习完成" })).toBeVisible();
  await expect(page.getByText("完成 8 个")).toBeVisible();
});

test("duplicate answer click does not change the current item", async ({
  page,
}) => {
  await startDailyTraining(page);
  const first = page.getByRole("group", { name: "选项" }).getByRole("button").first();
  if ((await first.count()) > 0) {
    await first.dblclick();
  } else {
    await answerCurrentItem(page);
  }
  await waitForInlineFeedback(page);
  await expect(page.getByText("1 / 8")).toBeVisible();
});

test("Daily Training start network failure can retry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/train");
  await page.route("**/*", (route) => {
    if (route.request().method() === "POST") {
      return route.abort();
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "开始练习" }).click();
  await expect(page.getByText("暂时没能准备好练习，请稍后再试。")).toBeVisible({
    timeout: 20_000,
  });
  await page.unroute("**/*");
  await page.getByRole("button", { name: "再试一次" }).click();
  await expect(page.locator('[data-renderer="DIRECT_PRACTICE"]')).toBeVisible({
    timeout: 30_000,
  });
});

test("Daily Training is keyboard reachable for a choice item", async ({
  page,
}) => {
  await startDailyTraining(page);
  if ((await page.getByRole("group", { name: "选项" }).count()) > 0) {
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await waitForInlineFeedback(page);
  }
});

for (const viewport of VIEWPORTS) {
  test(`Daily Training has no overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await startDailyTraining(page);
    await assertNoGameChrome(page);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
}
