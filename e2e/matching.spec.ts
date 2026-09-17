import { expect, test } from "@playwright/test";

test("Matching start → target + candidate → feedback → continue → progress", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/matching");
  await page.getByRole("button", { name: "开始" }).click();
  await expect(page.getByText(/连连看进度/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("group", { name: "连连看棋盘" })).toBeVisible();

  const target = page.getByRole("button", { name: /^目标：/ });
  await expect(target).toBeVisible();
  const candidates = page.getByRole("group", { name: "候选" }).getByRole("button");
  await expect(candidates.first()).toBeVisible();

  await target.click();
  await candidates.first().click();
  await expect(target).toBeDisabled();

  const continueButton = page.getByRole("button", { name: "继续" });
  await expect(continueButton).toBeVisible({ timeout: 30_000 });
  await continueButton.click();
  await expect(
    page
      .getByRole("heading", { name: "连连看完成" })
      .or(page.getByRole("group", { name: "连连看棋盘" })),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/连连看进度/)).toBeVisible();
});

test("Matching refresh after target click restores the same task without Evidence", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/matching");
  await page.getByRole("button", { name: "开始" }).click();
  await expect(page.getByText(/连连看进度/)).toBeVisible({ timeout: 30_000 });

  const target = page.getByRole("button", { name: /^目标：/ });
  const targetLabel = await target.getAttribute("aria-label");
  await target.click();
  await expect(target).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "继续" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(/连连看进度/)).toBeVisible({ timeout: 30_000 });
  const restored = page.getByRole("button", { name: /^目标：/ });
  await expect(restored).toBeVisible();
  await expect(restored).toHaveAttribute("aria-label", targetLabel ?? "");
  await expect(restored).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "继续" })).toHaveCount(0);
});
