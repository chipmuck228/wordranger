import { expect, test } from "@playwright/test";

test("Ranger Trial start → answer → feedback → continue → complete", async ({
  page,
}) => {
  await page.goto("/play/ranger-trial");
  await page.getByRole("button", { name: "开始闯关" }).click();
  await expect(page.getByText(/闯关进度/)).toBeVisible({ timeout: 30_000 });

  for (let round = 0; round < 8; round += 1) {
    if (await page.getByRole("heading", { name: "闯关完成" }).isVisible()) {
      break;
    }
    const options = page.getByRole("group", { name: "选项" }).getByRole("button");
    const submit = page.getByRole("button", { name: "提交" });
    if ((await options.count()) > 0) {
      const first = options.first();
      await first.click();
      await expect(first).toBeDisabled();
    } else if (await submit.isVisible()) {
      await page.getByLabel("英文答案").fill("word");
      await submit.click();
      await expect(submit).toBeDisabled();
    } else {
      break;
    }
    const continueButton = page.getByRole("button", { name: "继续" });
    await expect(continueButton).toBeVisible({ timeout: 30_000 });
    await continueButton.click();
    await expect(
      page
        .getByRole("heading", { name: "闯关完成" })
        .or(page.getByRole("group", { name: "选项" }))
        .or(page.getByLabel("英文答案")),
    ).toBeVisible({ timeout: 30_000 });
  }

  await expect(page.getByRole("heading", { name: "闯关完成" })).toBeVisible();
  await expect(page.getByText("完成", { exact: true })).toBeVisible();
});

test("Ranger Trial refresh resumes the durable session", async ({ page }) => {
  await page.goto("/play/ranger-trial");
  await page.getByRole("button", { name: "开始闯关" }).click();
  await expect(page.getByText(/闯关进度/)).toBeVisible({ timeout: 30_000 });

  const options = page.getByRole("group", { name: "选项" }).getByRole("button");
  const submit = page.getByRole("button", { name: "提交" });
  if ((await options.count()) > 0) {
    await options.first().click();
  } else {
    await page.getByLabel("英文答案").fill("word");
    await submit.click();
  }
  const continueButton = page.getByRole("button", { name: "继续" });
  await expect(continueButton).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByRole("button", { name: "继续" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "继续" }).click();
  await expect(
    page
      .getByRole("heading", { name: "闯关完成" })
      .or(page.getByRole("group", { name: "选项" }))
      .or(page.getByLabel("英文答案")),
  ).toBeVisible({ timeout: 30_000 });
});
