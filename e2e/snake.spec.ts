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
  for (let step = 0; step < 60; step += 1) {
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
}

test("Snake start → collide with option → feedback → continue → progress", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/snake?tickMs=40");
  await page.getByRole("button", { name: "开始" }).click();
  await expect(page.getByText(/贪食蛇进度/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("application", { name: "贪食蛇棋盘" })).toBeVisible();
  await expect(page.locator("[data-option-id]").first()).toBeVisible();

  await steerToFirstOption(page);
  const continueButton = page.getByRole("button", { name: "继续" });
  await expect(continueButton).toBeVisible({ timeout: 30_000 });
  await continueButton.click();
  await expect(
    page
      .getByRole("heading", { name: "贪食蛇完成" })
      .or(page.getByRole("application", { name: "贪食蛇棋盘" })),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/贪食蛇进度/)).toBeVisible();
});
