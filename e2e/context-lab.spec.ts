import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const QA_DIR = "test-results/context-lab-qa";
const FORBIDDEN_PAYLOAD = [
  "answerKey",
  "correctOptionIds",
  "optionLexemeIds",
  "expectedAnswer",
  "exactAcceptedTexts",
  "semanticAcceptedTexts",
  "isCorrect",
  "LearningEvidence",
  "StudentLexemeModel",
] as const;

const PROHIBITED_REQUEST =
  /\/train(?:\/|$|\?)|\/play\/ranger-trial|\/play\/word-bubble|\/play\/matching|\/play\/snake|submit-task|supabase\.co|learning_evidence|student_lexeme/i;

const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

function collectProhibited(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (PROHIBITED_REQUEST.test(request.url())) {
      urls.push(request.url());
    }
  });
  return urls;
}

function collectContextLabMutations(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST") {
      return;
    }
    if (!/\/play\/context-lab(?:\/|$|\?)/.test(request.url())) {
      return;
    }
    urls.push(request.url());
  });
  return urls;
}

async function resetMemoryProbe(page: Page): Promise<void> {
  await page.request.post("/play/context-lab/memory-probe");
}

async function memoryEvidence(page: Page): Promise<{
  evidenceCount: number;
  items: Array<{ taskId: string | null; sessionId: string; gameId: string; outcome: string }>;
}> {
  const response = await page.request.get("/play/context-lab/memory-probe");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function walkGuidedToPreview(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "早餐时间" })).toBeVisible();
  await expect(page.getByText("1 / 4")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子 → 适合舀汤")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子：舀取汤或柔软食物")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByLabel("英文答案")).toBeVisible();
  await expect(page.getByText("4 / 4")).toBeVisible();
}

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

async function assertNoForbiddenPayload(page: Page): Promise<void> {
  const html = await page.content();
  const scripts = await page.locator("script").allTextContents();
  const payload = [html, ...scripts].join("\n");
  for (const field of FORBIDDEN_PAYLOAD) {
    expect(payload, field).not.toContain(field);
  }
  expect(payload).not.toMatch(/已经掌握|永远记住了|学习完成|能力提升/);

  const storage = await page.evaluate(() => ({
    search: window.location.search,
    localStorage: { ...window.localStorage },
    sessionStorage: { ...window.sessionStorage },
    hidden: [...document.querySelectorAll("input[type=hidden]")].map(
      (input) => (input as HTMLInputElement).value,
    ),
    dataAttrs: [...document.querySelectorAll("*")].flatMap((node) =>
      [...node.attributes]
        .filter((attr) => attr.name.startsWith("data-"))
        .map((attr) => `${attr.name}=${attr.value}`),
    ),
  }));
  expect(storage.search).toBe("");
  expect(JSON.stringify(storage.localStorage)).not.toMatch(
    /answerKey|exactAcceptedTexts|semanticAcceptedTexts/,
  );
  expect(JSON.stringify(storage.sessionStorage)).not.toMatch(
    /answerKey|exactAcceptedTexts|semanticAcceptedTexts/,
  );
  expect(storage.hidden.join("")).not.toMatch(
    /answerKey|exactAcceptedTexts/,
  );
  expect(storage.dataAttrs.join("\n")).not.toMatch(
    /answerKey|exactAcceptedTexts|semanticAcceptedTexts/,
  );
}

async function capture(page: Page, name: string): Promise<void> {
  mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({
    path: `${QA_DIR}/${name}.png`,
    fullPage: true,
  });
}

async function walkMealFlow(page: Page, prefix: string): Promise<void> {
  await page.goto("/play/context-lab");
  await expect(page.getByRole("heading", { name: "早餐时间" })).toBeVisible();
  await expect(page.getByText("1 / 4")).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-01-ground`);

  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子 → 适合舀汤")).toBeVisible();
  await expect(page.getByText("2 / 4")).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-02-relation`);

  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子：舀取汤或柔软食物")).toBeVisible();
  await expect(page.getByText("3 / 4")).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-03-contrast`);

  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByLabel("英文答案")).toBeVisible();
  await expect(page.getByText("4 / 4")).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-04-preview`);

  await page.getByLabel("英文答案").fill("spoon");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-05-recorded`);
}

test("Context Lab Meal BUILD presentation reaches the assigned frozen task", async ({
  page,
}) => {
  const prohibited = collectProhibited(page);
  const mutations = collectContextLabMutations(page);
  await resetMemoryProbe(page);

  await page.goto("/play/context-lab");
  await expect(page.getByText("早餐时间")).toBeVisible();
  await expect(page.getByText("汤", { exact: true })).toBeVisible();
  await expect(page.getByText("碗", { exact: true })).toBeVisible();
  await expect(page.getByText("勺子", { exact: true })).toBeVisible();
  await expect(page.getByText("叉子", { exact: true })).toBeVisible();
  await expect(page.getByText("1 / 4")).toBeVisible();

  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子 → 适合舀汤")).toBeVisible();
  await expect(page.getByText(/掌握了|完成学习|挑战成功/)).toHaveCount(0);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子：舀取汤或柔软食物")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();

  const input = page.getByLabel("英文答案");
  await expect(input).toBeVisible();
  await input.fill("spoon");
  await page.getByRole("button", { name: "提交" }).click();
  const recorded = page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]');
  await expect(recorded).toBeVisible();
  await expect(recorded.getByText("答对了！", { exact: true })).toBeVisible();
  await expect(recorded.getByText("这次练习已记录。", { exact: true })).toBeVisible();
  await expect(page.getByText(/已经掌握|永远记住了|学习完成|能力提升/)).toHaveCount(0);

  await assertNoForbiddenPayload(page);
  const evidence = await memoryEvidence(page);
  expect(evidence.evidenceCount).toBe(1);
  expect(evidence.items[0]?.gameId).toBe("RANGER_TRIAL");

  const firstRunProgress = page.getByText("1 / 4");
  await page.getByRole("button", { name: "重新体验" }).click();
  await expect(firstRunProgress).toBeVisible();
  await expect(
    page.getByText("桌上有汤、碗、勺子和叉子。先看看这些物品。", {
      exact: true,
    }),
  ).toBeVisible();

  expect(prohibited).toEqual([]);
  expect(mutations.length).toBeGreaterThanOrEqual(5);
});

test("Context Lab uses one start and one acknowledgement per Guided step", async ({
  page,
}) => {
  const mutations = collectContextLabMutations(page);
  await page.goto("/play/context-lab");
  await expect(page.getByText("1 / 4")).toBeVisible();
  const afterStart = mutations.length;
  expect(afterStart).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("2 / 4")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("3 / 4")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByLabel("英文答案")).toBeVisible();
  expect(mutations.length - afterStart).toBe(3);
});

test("correct and incorrect submissions each write one Evidence in memory", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await walkGuidedToPreview(page);
  await page.getByLabel("英文答案").fill("spoon");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  expect((await memoryEvidence(page)).evidenceCount).toBe(1);

  await page.getByRole("button", { name: "重新体验" }).click();
  await walkGuidedToPreview(page);
  await page.getByLabel("英文答案").fill("fork");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  const afterIncorrect = await memoryEvidence(page);
  expect(afterIncorrect.evidenceCount).toBe(2);
  expect(afterIncorrect.items.some((item) => item.outcome === "INCORRECT")).toBe(true);
});

test("duplicate click writes one Evidence", async ({ page }) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await walkGuidedToPreview(page);
  await page.getByLabel("英文答案").fill("spoon");
  await page.getByRole("button", { name: "提交" }).dblclick();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  expect((await memoryEvidence(page)).evidenceCount).toBe(1);
});

test("refresh after submit does not duplicate Evidence for the same task", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await walkGuidedToPreview(page);
  await page.getByLabel("英文答案").fill("spoon");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  const before = await memoryEvidence(page);
  expect(before.evidenceCount).toBe(1);
  await page.reload();
  await expect(page.getByText("1 / 4")).toBeVisible();
  expect((await memoryEvidence(page)).evidenceCount).toBe(1);
});

test("refresh starts a new experimental run", async ({ page }) => {
  await page.goto("/play/context-lab");
  await expect(page.getByText("1 / 4")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("2 / 4")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 / 4")).toBeVisible();
  await expect(
    page.getByText("桌上有汤、碗、勺子和叉子。先看看这些物品。", {
      exact: true,
    }),
  ).toBeVisible();
});

test("rapid double-click does not skip a Guided step", async ({ page }) => {
  await page.goto("/play/context-lab");
  await expect(page.getByText("1 / 4")).toBeVisible();
  const next = page.getByRole("button", { name: "继续" });
  await next.dblclick();
  await expect(page.getByText("2 / 4")).toBeVisible();
  await expect(page.getByText("3 / 4")).toHaveCount(0);
});

for (const viewport of VIEWPORTS) {
  test(`Context Lab layout and screenshots at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await walkMealFlow(page, viewport.name);
  });
}

test("keyboard-only navigation can complete the presentation", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await expect(page.getByRole("heading", { name: "早餐时间" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "继续" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("勺子 → 适合舀汤")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).press("Space");
  await expect(page.getByText("勺子：舀取汤或柔软食物")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).press("Enter");
  await expect(page.getByLabel("英文答案")).toBeVisible();
  await page.getByLabel("英文答案").fill("spoon");
  await page.getByLabel("英文答案").press("Enter");
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
});

test("reduced-motion browser context can complete the flow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/context-lab");
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("2 / 4")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("3 / 4")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByLabel("英文答案")).toBeVisible();
  await page.getByLabel("英文答案").fill("spoon");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
});

test("disabled feature gate returns 404", async ({ request }) => {
  const baseURL = await startDisabledContextLab();
  try {
    const response = await request.get(`${baseURL}/play/context-lab`);
    expect(response.status()).toBe(404);
    const body = await response.text();
    expect(body).not.toContain("早餐时间");
    expect(body).not.toContain("answerKey");
  } finally {
    stopDisabledContextLab();
  }
});

let disabledServer: ChildProcess | undefined;

async function startDisabledContextLab(): Promise<string> {
  const env = {
    ...process.env,
    CONTEXT_LAB_ENABLED: "0",
    CONTEXT_LAB_RUNTIME: "memory",
  };
  const child = spawn(
    "npx",
    ["next", "start", "--hostname", "127.0.0.1", "--port", "3318"],
    {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  disabledServer = child;
  const started = await waitForServer("http://127.0.0.1:3318", child);
  if (!started) {
    stopDisabledContextLab();
    throw new Error(
      "Disabled Context Lab server did not become ready on 127.0.0.1:3318",
    );
  }
  return "http://127.0.0.1:3318";
}

function stopDisabledContextLab(): void {
  disabledServer?.kill("SIGTERM");
  disabledServer = undefined;
}

async function waitForServer(
  url: string,
  child: ChildProcess,
  timeoutMs = 45_000,
): Promise<boolean> {
  const startedAt = Date.now();
  let exitCode: number | null = null;
  child.once("exit", (code) => {
    exitCode = code;
  });
  while (Date.now() - startedAt < timeoutMs) {
    if (exitCode !== null) {
      return false;
    }
    try {
      await fetch(url, { method: "GET" });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return false;
}
