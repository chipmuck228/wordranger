import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

async function assertNoOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function assertHomeStructure(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "让学过的单词，在需要时想得起来" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "自由练习" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "场景学习" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "学习会怎样进行？" })).toBeVisible();
  await expect(page.getByRole("link", { name: "继续今天的学习" })).toBeVisible();
  await expect(page.getByRole("link", { name: "进入场景" })).toBeVisible();
  await expect(page.getByRole("link", { name: "连连看" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "贪食蛇" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "单词泡泡" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "单词闯关" })).toHaveCount(0);
  await expect(page.getByText("Debug 工具")).toHaveCount(0);
  await expect(page.getByText(/9 个目标词/)).toHaveCount(0);
  await expect(page.getByText(/fingerprint|AnswerKey|ExperienceRun/i)).toHaveCount(0);
}

test("Homepage learning-path information architecture", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await assertHomeStructure(page);
  await page.getByRole("link", { name: "继续今天的学习" }).click();
  await expect(page).toHaveURL(/\/train/);
});

test("Homepage scene entry opens Context Lab when the ordinary lab is startable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: "进入场景" }).click();
  await expect(page).toHaveURL(/\/play\/context-lab/);
  await expect(page.getByText("页面不存在")).toHaveCount(0);
});

test("Homepage keeps Settings-only Debug tools and no student Debug links", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("heading", { name: "Debug 工具" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "词汇调试" })).toHaveCount(0);
});

for (const viewport of VIEWPORTS) {
  test(`Homepage has no overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await assertHomeStructure(page);
    await assertNoOverflow(page);
  });
}

test("Homepage primary and scene actions are keyboard reachable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "设置" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "继续今天的学习" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "进入场景" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/play\/context-lab/);
});

test("old free-play routes remain directly reachable", async ({ page }) => {
  const ranger = await page.goto("/play/ranger-trial");
  expect(ranger?.ok()).toBeTruthy();
  await expect(page.getByText("自由练习")).toBeVisible();

  const matching = await page.goto("/play/matching");
  expect(matching?.ok()).toBeTruthy();
  await expect(page.getByText(/连连看/)).toBeVisible();

  const bubble = await page.goto("/play/word-bubble");
  expect(bubble?.ok()).toBeTruthy();

  const snake = await page.goto("/play/snake");
  expect(snake?.ok()).toBeTruthy();
});
