import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const curatedPath = path.join(
  process.cwd(),
  "data/vocabulary/placement/curated-word-placement.json",
);
const originalCurated = readFileSync(curatedPath);

test.afterEach(() => {
  writeFileSync(curatedPath, originalCurated);
});

test("student home does not link to vocabulary placement review", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "继续今天的学习" })).toBeVisible();
  await expect(page.locator('a[href="/debug/vocabulary-placement"]')).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open Vocabulary Placement Review" }),
  ).toHaveCount(0);
});

test("internal placement review route still exists", async ({ page }) => {
  await page.goto("/debug/vocabulary-placement");
  await expect(page.getByRole("heading", { name: "Vocabulary Placement Review" })).toBeVisible();
});

test("Vocabulary placement review can save a curated override across reload", async ({
  page,
}) => {
  await page.goto("/debug/vocabulary-placement");
  await expect(page.getByRole("heading", { name: "Vocabulary Placement Review" })).toBeVisible();
  await page.getByLabel("Search").fill("ability");
  await expect(page.getByTestId("review-lemma")).toHaveText("ability");
  const provisional = (await page.getByTestId("provisional-band").innerText()).trim();
  const otherBand = provisional === "BAND_1" ? "BAND_3" : "BAND_1";
  await page.getByTestId(`band-${otherBand}`).click();
  await page.getByLabel("Review note").fill("e2e curated override");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("effective-band")).toHaveText(otherBand);
  await expect(page.getByTestId("curated-band")).toHaveText(otherBand);
  await expect(page.getByTestId("review-status")).toHaveText("REVIEWED");

  await page.reload();
  await page.getByLabel("Search").fill("ability");
  await expect(page.getByTestId("review-lemma")).toHaveText("ability");
  await expect(page.getByTestId("effective-band")).toHaveText(otherBand);
  await expect(page.getByTestId("curated-band")).toHaveText(otherBand);
  await expect(page.getByTestId("review-status")).toHaveText("REVIEWED");
  expect(readFileSync(curatedPath, "utf8")).toContain("e2e curated override");
});
