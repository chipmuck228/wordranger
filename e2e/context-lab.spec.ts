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
  expect(payload).not.toMatch(/答对了|掌握了|完成学习/);

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
    /answerKey|exactAcceptedTexts|spoon/,
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
  await expect(page.getByLabel("英文答案预览")).toBeVisible();
  await expect(page.getByText("4 / 4")).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-04-preview`);

  await page.getByRole("button", { name: "提交功能将在下一阶段接入" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_HANDOFF_READY"]')).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-05-handoff`);
}

test("Context Lab Meal BUILD presentation reaches the frozen-task boundary", async ({
  page,
}) => {
  const prohibited = collectProhibited(page);

  await page.goto("/play/context-lab");
  await expect(page.getByText("早餐时间")).toBeVisible();
  await expect(page.getByText("汤", { exact: true })).toBeVisible();
  await expect(page.getByText("碗", { exact: true })).toBeVisible();
  await expect(page.getByText("勺子", { exact: true })).toBeVisible();
  await expect(page.getByText("叉子", { exact: true })).toBeVisible();
  await expect(page.getByText("1 / 4")).toBeVisible();

  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子 → 适合舀汤")).toBeVisible();
  await expect(page.getByText(/答对了|掌握了|完成学习|挑战成功/)).toHaveCount(0);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("勺子：舀取汤或柔软食物")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();

  const input = page.getByLabel("英文答案预览");
  await expect(input).toBeVisible();
  await input.fill("spoon");
  await input.press("Enter");
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_HANDOFF_READY"]')).toHaveCount(0);
  await expect(page.getByText(/答对了|掌握了|完成学习|挑战成功/)).toHaveCount(0);

  await page.getByRole("button", { name: "提交功能将在下一阶段接入" }).click();
  const boundary = page.locator('[data-pilot-state="FROZEN_TASK_HANDOFF_READY"]');
  await expect(boundary).toBeVisible();
  await expect(boundary.getByText(/交接点/)).toBeVisible();
  await expect(
    boundary.getByText(/下一阶段会通过 WordRanger 原有提交与证据流程完成这道题/),
  ).toBeVisible();

  await assertNoForbiddenPayload(page);

  await page.getByRole("button", { name: "重新体验" }).click();
  await expect(page.getByText("1 / 4")).toBeVisible();
  await expect(
    page.getByText("桌上有汤、碗、勺子和叉子。先看看这些物品。", {
      exact: true,
    }),
  ).toBeVisible();

  expect(prohibited).toEqual([]);
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
  await page.goto("/play/context-lab");
  await expect(page.getByRole("heading", { name: "早餐时间" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "继续" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("勺子 → 适合舀汤")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).press("Space");
  await expect(page.getByText("勺子：舀取汤或柔软食物")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).press("Enter");
  await expect(page.getByLabel("英文答案预览")).toBeVisible();
  await page.getByRole("button", { name: "提交功能将在下一阶段接入" }).press("Enter");
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_HANDOFF_READY"]')).toBeVisible();
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
  await expect(page.getByLabel("英文答案预览")).toBeVisible();
  await page.getByRole("button", { name: "提交功能将在下一阶段接入" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_HANDOFF_READY"]')).toBeVisible();
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
