import { expect, test, type Page } from "@playwright/test";

const PRACTICE = "http://127.0.0.1:3323";
const ORDINARY = "http://127.0.0.1:3317";
const SESSION_KEY = "wordranger.free-practice.session-id";

const PAIRS = [
  ["apple", "苹果"],
  ["bread", "面包"],
  ["water", "水"],
  ["knife", "刀"],
  ["plate", "盘子"],
  ["spoon", "勺子"],
  ["cup", "杯子"],
  ["table", "桌子"],
  ["chair", "椅子"],
  ["door", "门"],
  ["window", "窗户"],
  ["book", "书"],
] as const;

const FORBIDDEN = [
  "userId",
  "answerKey",
  "correctOptionIds",
  "exactAcceptedTexts",
  "semanticAcceptedTexts",
  "LearningEvidence",
  "StudentLexemeModel",
  "FreePracticeSessionState",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

async function resetPractice(page: Page): Promise<void> {
  const response = await page.request.post(`${PRACTICE}/practice/e2e-probe`, {
    data: { op: "reset" },
  });
  expect(response.ok()).toBeTruthy();
}

async function seedSeen(page: Page, count: number): Promise<void> {
  const response = await page.request.post(`${PRACTICE}/practice/e2e-probe`, {
    data: { op: "seed-seen", count },
  });
  expect(response.ok()).toBeTruthy();
}

async function practiceSnapshot(page: Page): Promise<{
  evidenceCount: number;
  sessionCount: number;
  taskCount: number;
  sessionIds: string[];
  taskIds: string[];
  items: Array<{ taskId: string; sessionId: string }>;
}> {
  const response = await page.request.get(`${PRACTICE}/practice/e2e-probe`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    evidenceCount: number;
    sessionCount: number;
    taskCount: number;
    sessionIds: string[];
    taskIds: string[];
    items: Array<{ taskId: string; sessionId: string }>;
  };
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(
    /userId|answerKey|correctOptionIds|FreePracticeSessionState|StudentLexemeModel/,
  );
  return body;
}

async function evidenceSnapshot(page: Page): Promise<{
  evidenceCount: number;
  items: Array<{ taskId: string; sessionId: string }>;
}> {
  return practiceSnapshot(page);
}

async function openSelector(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${PRACTICE}/practice`);
  await expect(page.getByRole("heading", { name: "自由练习" })).toBeVisible();
}

async function startSource(
  page: Page,
  source: "练习新单词" | "复习最近答错的单词",
  count: 5 | 10,
): Promise<void> {
  await page.getByRole("radio", { name: source }).check();
  await page.getByRole("radio", { name: `${count} 个` }).check();
  await page.getByRole("button", { name: "开始练习" }).click();
}

async function waitForTask(page: Page): Promise<void> {
  await expect(page.locator('[data-renderer="DIRECT_PRACTICE"]')).toBeVisible({
    timeout: 30_000,
  });
}

async function headline(page: Page): Promise<string> {
  return (
    await page.locator('[data-renderer="DIRECT_PRACTICE"] p.text-3xl').innerText()
  ).trim();
}

async function answerCurrent(page: Page, correct: boolean): Promise<void> {
  const options = page.getByRole("group", { name: "选项" }).getByRole("button");
  const input = page.getByLabel("英文答案");
  if ((await options.count()) > 0) {
    await expect(options.first()).toBeEnabled({ timeout: 30_000 });
  } else {
    await expect(input).toBeEnabled({ timeout: 30_000 });
  }
  const prompt = await headline(page);
  const pair = PAIRS.find(([en, zh]) => prompt.includes(en) || prompt.includes(zh));
  if ((await options.count()) > 0) {
    const target = pair
      ? prompt.includes(pair[0])
        ? pair[1]
        : pair[0]
      : null;
    if (correct && target) {
      await options.filter({ hasText: target }).first().click();
      return;
    }
    if (!correct && target) {
      await options.filter({ hasNotText: target }).first().click();
      return;
    }
    await options.last().click();
    return;
  }
  if (await input.isVisible()) {
    await input.fill(correct && pair ? pair[0] : "zzzz");
    await page.getByRole("button", { name: "提交" }).click();
  }
}

async function waitForFeedback(page: Page): Promise<void> {
  await expect(page.locator("[data-feedback-status]").first()).toBeVisible({
    timeout: 30_000,
  });
}

async function completeItems(
  page: Page,
  count: number,
  correct: boolean,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    if (await page.getByRole("heading", { name: "本组练习完成" }).isVisible()) {
      return;
    }
    await waitForTask(page);
    await answerCurrent(page, correct);
    await waitForFeedback(page);
    await expect(page.locator("[data-feedback-status]")).toHaveCount(1);
    const finish = page.getByRole("button", { name: "完成" });
    if (await finish.isVisible()) {
      await finish.click();
      break;
    }
    const before = await headline(page);
    await page.getByRole("button", { name: "下一题" }).click();
    await expect(
      page.locator('[data-renderer="DIRECT_PRACTICE"] p.text-3xl'),
    ).not.toHaveText(before, { timeout: 30_000 });
  }
  await expect(page.getByRole("heading", { name: "本组练习完成" })).toBeVisible({
    timeout: 30_000,
  });
}

function watchPayloads(page: Page): string[] {
  const leaks: string[] = [];
  page.on("response", async (response) => {
    if (response.request().method() !== "POST") {
      return;
    }
    if (!response.url().includes("/practice")) {
      return;
    }
    try {
      const body = await response.text();
      for (const token of FORBIDDEN) {
        if (body.includes(`"${token}"`)) {
          leaks.push(`${token}:${response.url()}`);
        }
      }
    } catch {
      // ignore binary
    }
  });
  return leaks;
}

test.describe("Free Practice /practice Candidate UI", () => {
  test.use({ baseURL: PRACTICE });

  test("happy path UNSEEN 5 with one Evidence each", async ({ page }) => {
    const leaks = watchPayloads(page);
    await resetPractice(page);
    await openSelector(page);
    await startSource(page, "练习新单词", 5);
    await expect(page.locator('[data-progress="1/5"]')).toBeVisible({
      timeout: 30_000,
    });
    await completeItems(page, 5, true);
    await expect(page.getByText("完成 5 个")).toBeVisible();
    await expect(page.getByText(/答对 \d+ 个/)).toBeVisible();
    const snapshot = await evidenceSnapshot(page);
    expect(snapshot.evidenceCount).toBe(5);
    expect(new Set(snapshot.items.map((item) => item.taskId)).size).toBe(5);
    expect(leaks).toEqual([]);
    const stored = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY);
    expect(stored).toBeTruthy();
    expect(stored?.includes("{")).toBeFalsy();
  });

  test("PARTIAL 3/10 shows 1 / 3", async ({ page }) => {
    await resetPractice(page);
    await seedSeen(page, 9);
    await openSelector(page);
    await startSource(page, "练习新单词", 10);
    await expect(page.getByText("这次有 3 个可练习的单词")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-progress="1/3"]')).toBeVisible();
    await expect(page.locator('[data-progress="1/10"]')).toHaveCount(0);
  });

  test("EMPTY does not create a session", async ({ page }) => {
    await resetPractice(page);
    await seedSeen(page, 12);
    await openSelector(page);
    await startSource(page, "练习新单词", 5);
    await expect(page.getByText("现在没有可练习的新单词")).toBeVisible({
      timeout: 30_000,
    });
    const stored = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY);
    expect(stored).toBeNull();
    expect((await evidenceSnapshot(page)).evidenceCount).toBe(0);
  });

  test("RECENTLY_INCORRECT becomes EMPTY after the same skill is correct", async ({
    page,
  }) => {
    await resetPractice(page);
    await openSelector(page);
    await startSource(page, "练习新单词", 5);
    await completeItems(page, 5, false);
    await page.getByRole("button", { name: "重新选择" }).click();
    await startSource(page, "复习最近答错的单词", 5);
    await completeItems(page, 5, true);
    await page.getByRole("button", { name: "重新选择" }).click();
    await startSource(page, "复习最近答错的单词", 5);
    await expect(page.getByText("最近没有答错的单词")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("refresh restores AWAITING_ACTION, AWAITING_CONTINUE, and COMPLETED", async ({
    page,
  }) => {
    await resetPractice(page);
    await openSelector(page);
    await startSource(page, "练习新单词", 5);
    await waitForTask(page);
    const first = await headline(page);
    await page.reload();
    await waitForTask(page);
    await expect(page.locator('[data-progress="1/5"]')).toBeVisible();
    expect(await headline(page)).toBe(first);

    await answerCurrent(page, true);
    await waitForFeedback(page);
    await page.reload();
    await waitForFeedback(page);
    await expect(page.locator('[data-progress="1/5"]')).toBeVisible();
    expect(await headline(page)).toBe(first);

    await page.getByRole("button", { name: "下一题" }).click();
    await waitForTask(page);
    await completeItems(page, 4, true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "本组练习完成" })).toBeVisible();
    await expect(page.getByText("完成 5 个")).toBeVisible();
  });

  test("double click start creates one session and one task", async ({
    page,
  }) => {
    await resetPractice(page);
    await openSelector(page);
    await page.getByRole("radio", { name: "练习新单词" }).check();
    await page.getByRole("radio", { name: "5 个" }).check();
    const start = page.getByRole("button", { name: "开始练习" });
    await start.dblclick();
    await waitForTask(page);
    await expect(page.locator('[data-progress="1/5"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "开始练习" })).toHaveCount(0);
    const snapshot = await practiceSnapshot(page);
    expect(snapshot.sessionCount).toBe(1);
    expect(snapshot.taskCount).toBe(1);
    expect(snapshot.evidenceCount).toBe(0);
    expect(new Set(snapshot.sessionIds).size).toBe(1);
    expect(new Set(snapshot.taskIds).size).toBe(1);
    const stored = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY);
    expect(stored).toBe(snapshot.sessionIds[0]);
  });

  test("start network failure can retry once", async ({ page }) => {
    await resetPractice(page);
    await openSelector(page);
    await page.getByRole("radio", { name: "练习新单词" }).check();
    await page.getByRole("radio", { name: "5 个" }).check();
    let failed = false;
    await page.route("**/practice", (route) => {
      if (route.request().method() === "POST" && !failed) {
        failed = true;
        return route.abort();
      }
      return route.continue();
    });
    await page.getByRole("button", { name: "开始练习" }).click();
    await expect(page.getByText("暂时无法加载")).toBeVisible({ timeout: 20_000 });
    await page.unroute("**/practice");
    await page.getByRole("button", { name: "重试" }).click();
    await waitForTask(page);
    const snapshot = await practiceSnapshot(page);
    expect(snapshot.sessionCount).toBe(1);
    expect(snapshot.taskCount).toBe(1);
    expect(snapshot.evidenceCount).toBe(0);
  });

  test("duplicate submit writes one Evidence", async ({ page }) => {
    await resetPractice(page);
    await openSelector(page);
    await startSource(page, "练习新单词", 5);
    await waitForTask(page);
    const options = page.getByRole("group", { name: "选项" }).getByRole("button");
    if ((await options.count()) > 0) {
      await options.first().dblclick();
    } else {
      await page.getByLabel("英文答案").fill("zzzz");
      await page.getByRole("button", { name: "提交" }).dblclick();
    }
    await waitForFeedback(page);
    expect((await evidenceSnapshot(page)).evidenceCount).toBe(1);
  });

  test("rapid double continue does not skip", async ({ page }) => {
    await resetPractice(page);
    await openSelector(page);
    await startSource(page, "练习新单词", 5);
    await waitForTask(page);
    await answerCurrent(page, true);
    await waitForFeedback(page);
    const next = page.getByRole("button", { name: "下一题" });
    await next.dblclick();
    await expect(page.locator('[data-progress="2/5"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-progress="3/5"]')).toHaveCount(0);
  });

  test("submit network failure retries the same task", async ({ page }) => {
    await resetPractice(page);
    await openSelector(page);
    await startSource(page, "练习新单词", 5);
    await waitForTask(page);
    const first = await headline(page);
    let failed = false;
    await page.route("**/practice", (route) => {
      if (route.request().method() === "POST" && !failed) {
        failed = true;
        return route.abort();
      }
      return route.continue();
    });
    await answerCurrent(page, true);
    await expect(page.getByText("暂时无法加载")).toBeVisible({ timeout: 20_000 });
    await page.unroute("**/practice");
    await page.getByRole("button", { name: "重试" }).click();
    await waitForFeedback(page);
    expect(await headline(page)).toBe(first);
    expect((await evidenceSnapshot(page)).evidenceCount).toBe(1);
  });

  test("continue network failure retries without skipping", async ({ page }) => {
    await resetPractice(page);
    await openSelector(page);
    await startSource(page, "练习新单词", 5);
    await waitForTask(page);
    await answerCurrent(page, true);
    await waitForFeedback(page);
    let failed = false;
    await page.route("**/practice", (route) => {
      if (route.request().method() === "POST" && !failed) {
        failed = true;
        return route.abort();
      }
      return route.continue();
    });
    await page.getByRole("button", { name: "下一题" }).click();
    await expect(page.getByText("暂时无法加载")).toBeVisible({ timeout: 20_000 });
    await page.unroute("**/practice");
    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.locator('[data-progress="2/5"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-progress="3/5"]')).toHaveCount(0);
  });

  test("keyboard-only can complete one item", async ({ page }) => {
    await resetPractice(page);
    await openSelector(page);
    await page.getByRole("radio", { name: "练习新单词" }).check();
    await page.getByRole("radio", { name: "5 个" }).check();
    await page.getByRole("button", { name: "开始练习" }).press("Enter");
    await waitForTask(page);
    if ((await page.getByRole("group", { name: "选项" }).count()) > 0) {
      await page.getByRole("group", { name: "选项" }).getByRole("button").first().press("Enter");
    } else {
      await page.getByLabel("英文答案").fill("zzzz");
      await page.getByLabel("英文答案").press("Enter");
    }
    await waitForFeedback(page);
    await page.getByRole("button", { name: "下一题" }).press("Enter");
    await expect(page.locator('[data-progress="2/5"]')).toBeVisible({
      timeout: 30_000,
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await resetPractice(page);
      await openSelector(page);
      await startSource(page, "练习新单词", 5);
      await waitForTask(page);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
});

test.describe("Free Practice isolation on ordinary hosts", () => {
  test.use({ baseURL: ORDINARY });

  test("feature flag off returns 404", async ({ page }) => {
    const response = await page.goto("/practice");
    expect(response?.status()).toBe(404);
  });

  test("Homepage still has no /practice entry", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "开始自由练习" })).toHaveAttribute(
      "href",
      "/train",
    );
    await expect(page.locator('a[href="/practice"]')).toHaveCount(0);
  });

  test("/train is unchanged", async ({ page }) => {
    await page.goto("/train");
    await page.getByRole("button", { name: "开始练习" }).click();
    await expect(page.locator('[data-renderer="DIRECT_PRACTICE"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("1 / 8")).toBeVisible();
  });

  test("Context Lab is unaffected", async ({ page }) => {
    const response = await page.goto("/play/context-lab");
    expect(response?.status()).not.toBe(404);
  });
});
