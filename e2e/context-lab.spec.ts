import { expect, test } from "@playwright/test";

test("Context Lab Meal BUILD presentation reaches the frozen-task boundary", async ({
  page,
}) => {
  const trainRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/train")) {
      trainRequests.push(request.url());
    }
  });

  await page.goto("/play/context-lab");
  await expect(page.getByText("早餐时间")).toBeVisible();
  await expect(page.getByText("汤", { exact: true })).toBeVisible();
  await expect(page.getByText("碗", { exact: true })).toBeVisible();
  await expect(page.getByText("勺子", { exact: true })).toBeVisible();
  await expect(page.getByText("叉子", { exact: true })).toBeVisible();
  await expect(page.getByText("1 / 4")).toBeVisible();

  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子 → 适合舀汤")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子：舀取汤或柔软食物")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();

  const input = page.getByLabel("英文答案预览");
  await expect(input).toBeVisible();
  await input.fill("spoon");
  await expect(page.getByText(/答对了|掌握了|完成学习|挑战成功/)).toHaveCount(0);

  await page.getByRole("button", { name: "提交功能将在下一阶段接入" }).click();
  await expect(page.getByText(/交接点/)).toBeVisible();
  await expect(
    page.getByText(/下一阶段会通过 WordRanger 原有提交与证据流程完成这道题/),
  ).toBeVisible();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_HANDOFF_READY"]')).toBeVisible();

  const html = await page.content();
  expect(html).not.toContain("answerKey");
  expect(html).not.toContain("exactAcceptedTexts");
  expect(html).not.toContain("semanticAcceptedTexts");
  expect(html).not.toContain("correctOptionIds");
  expect(html).not.toMatch(/答对了|掌握了|完成学习/);

  await page.getByRole("button", { name: "重新体验" }).click();
  await expect(page.getByText("1 / 4")).toBeVisible();
  await expect(
    page.getByText("桌上有汤、碗、勺子和叉子。先看看这些物品。"),
  ).toBeVisible();

  expect(trainRequests).toEqual([]);
});
