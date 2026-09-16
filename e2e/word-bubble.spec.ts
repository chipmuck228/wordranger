import { expect, test } from "@playwright/test";

test("Word Bubble start → tap bubble → feedback → continue → progress", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/word-bubble");
  await page.getByRole("button", { name: "开始" }).click();
  await expect(page.getByText(/泡泡进度/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("group", { name: "单词泡泡" })).toBeVisible();

  const bubbles = page.getByRole("group", { name: "单词泡泡" }).getByRole("button");
  await expect(bubbles.first()).toBeVisible();
  const first = bubbles.first();
  await first.click();
  await expect(first).toBeDisabled();

  const continueButton = page.getByRole("button", { name: "继续" });
  await expect(continueButton).toBeVisible({ timeout: 30_000 });
  await continueButton.click();
  await expect(
    page
      .getByRole("heading", { name: "泡泡挑战完成" })
      .or(page.getByRole("group", { name: "单词泡泡" })),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/泡泡进度/)).toBeVisible();
});

test("Word Bubble refresh resumes the durable session", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/word-bubble");
  await page.getByRole("button", { name: "开始" }).click();
  await expect(page.getByText(/泡泡进度/)).toBeVisible({ timeout: 30_000 });

  const bubbles = page.getByRole("group", { name: "单词泡泡" }).getByRole("button");
  await bubbles.first().click();
  await expect(page.getByRole("button", { name: "继续" })).toBeVisible({
    timeout: 30_000,
  });

  await page.reload();
  await expect(page.getByRole("button", { name: "继续" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "继续" }).click();
  await expect(
    page
      .getByRole("heading", { name: "泡泡挑战完成" })
      .or(page.getByRole("group", { name: "单词泡泡" })),
  ).toBeVisible({ timeout: 30_000 });
});
