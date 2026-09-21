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
  if (!page.url().startsWith("http")) {
    await page.goto("/play/context-lab");
  }
  await page.evaluate(() => {
    sessionStorage.removeItem("context-lab-strengthen-run");
  });
  await page.request.post("/play/context-lab/memory-probe");
  await page.evaluate(() => {
    sessionStorage.removeItem("context-lab-strengthen-run");
  });
}

async function memoryEvidence(page: Page): Promise<{
  evidenceCount: number;
  items: Array<{
    taskId: string | null;
    sessionId: string;
    gameId: string;
    outcome: string;
    lexemeId?: string;
  }>;
}> {
  const response = await page.request.get("/play/context-lab/memory-probe");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

const PROBE_AVOID = ["汤", "碗", "匙", "叉", "杯"] as const;
const PROBE_LEMMAS = ["soup", "bowl", "spoon", "fork", "cup"] as const;

async function expectNeutralProbeRecorded(page: Page): Promise<void> {
  const recorded = page.locator('[data-pilot-state="PROBE_TASK_RECORDED"]');
  await expect(recorded).toBeVisible();
  await expect(recorded.getByText("这次回答已记录，请继续。")).toBeVisible();
  await expect(recorded.getByText("答对了！")).toHaveCount(0);
  await expect(recorded.getByText("回答不正确。")).toHaveCount(0);
}

async function completeOneTargetWrong(page: Page, index: number): Promise<void> {
  await expect(page.getByText(`${index + 1} / 5 个物品`)).toBeVisible();
  await expect(page.locator('[data-presentation-mode="SCENE_TARGET"]')).toBeVisible();
  await expect(page.getByLabel("英文答案")).toBeVisible();
  const recallText = await page.locator('[data-presentation-mode="SCENE_TARGET"]').innerText();
  expect(recallText).not.toMatch(new RegExp(`\\b${PROBE_LEMMAS[index]}\\b`, "i"));
  await page.getByLabel("英文答案").fill("nope");
  await page.getByRole("button", { name: "提交" }).click();
  await expectNeutralProbeRecorded(page);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-presentation-mode="TASK_ONLY"]')).toBeVisible();
  await expect(page.getByText(PROBE_LEMMAS[index], { exact: true })).toBeVisible();
  await expect(page.getByLabel("早餐桌上的物品")).toHaveCount(0);
  await clickWrongChoice(page, PROBE_AVOID[index]);
  await expectNeutralProbeRecorded(page);
  await page.getByRole("button", { name: "继续" }).click();
}

async function completeProbeAllWrong(page: Page): Promise<void> {
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);
  await page.getByRole("button", { name: "开始检查" }).click();
  for (let index = 0; index < 5; index += 1) {
    await completeOneTargetWrong(page, index);
  }
  await expect(page.getByText("建立情境记忆")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "开始建立 5 个词" })).toBeVisible();
}

async function clickWrongChoice(page: Page, avoid: string): Promise<void> {
  const options = page.locator('[role="group"][aria-label="选项"] button');
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const text = await options.nth(index).innerText();
    if (!text.includes(avoid)) {
      await options.nth(index).click();
      return;
    }
  }
  await options.last().click();
}

async function walkGuidedToPreview(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "早餐时间" })).toBeVisible();
  await completeProbeAllWrong(page);
  await page.getByRole("button", { name: "开始建立 5 个词" }).click();
  await walkBuildExperience(page, STRENGTHEN_TARGETS[0]);
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

const STRENGTHEN_TARGETS = [
  { lemma: "soup", label: "汤", meaning: "汤", cue: "s _ _ _", avoid: "汤" },
  { lemma: "bowl", label: "碗", meaning: "碗", cue: "b _ _ _", avoid: "碗" },
  { lemma: "spoon", label: "勺子", meaning: "匙，调羹", cue: "s _ _ _ _", avoid: "匙" },
  { lemma: "fork", label: "叉子", meaning: "叉，餐叉", cue: "f _ _ _", avoid: "叉" },
  { lemma: "cup", label: "杯子", meaning: "茶杯", cue: "c _ _", avoid: "杯" },
] as const;

async function completeProbeStrengthenTargets(
  page: Page,
  recognitionCorrect: readonly boolean[],
): Promise<void> {
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "开始检查" }).click();
  for (let index = 0; index < 5; index += 1) {
    await expect(page.getByText(`${index + 1} / 5 个物品`)).toBeVisible();
    if (index >= recognitionCorrect.length) {
      await page.getByLabel("英文答案").fill(PROBE_LEMMAS[index]);
      await page.getByRole("button", { name: "提交" }).click();
      await expectNeutralProbeRecorded(page);
      await page.getByRole("button", { name: "继续" }).click();
      continue;
    }
    await page.getByLabel("英文答案").fill("nope");
    await page.getByRole("button", { name: "提交" }).click();
    await expectNeutralProbeRecorded(page);
    await page.getByRole("button", { name: "继续" }).click();
    if (recognitionCorrect[index]) {
      await clickCorrectChoice(page, STRENGTHEN_TARGETS[index].avoid);
    } else {
      await clickWrongChoice(page, STRENGTHEN_TARGETS[index].avoid);
    }
    await expectNeutralProbeRecorded(page);
    await page.getByRole("button", { name: "继续" }).click();
  }
}

async function walkBuildExperience(
  page: Page,
  target: (typeof STRENGTHEN_TARGETS)[number],
): Promise<void> {
  await expect(page.getByText(`教学阶段：建立${target.label}的情境记忆`)).toBeVisible();
  await expect(page.locator('[data-build-phase="GROUND"]')).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-build-phase="CONNECT"]')).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  const reveal = page.locator('[data-support-kind="LEXICAL_FORM"]');
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText(target.lemma);
  await expect(reveal).toContainText(target.meaning);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-build-phase="CONTRAST"]')).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-build-phase="FADE"]')).toBeVisible();
  await expect(page.getByLabel("拼写提示")).toHaveText(target.cue);
  await expect(page.getByText(target.lemma, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "试着自己写" }).click();
  await expect(page.getByLabel("英文答案")).toBeVisible();
  await expect(page.getByText(target.lemma, { exact: true })).toHaveCount(0);
}

async function walkStrengthenExperience(
  page: Page,
  target: (typeof STRENGTHEN_TARGETS)[number],
): Promise<void> {
  await expect(page.getByText(`强化阶段：加强${target.label}的记忆连接`)).toBeVisible();
  const reveal = page.locator('[data-support-kind="LEXICAL_FORM"]');
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText(target.lemma);
  await expect(reveal).toContainText(target.meaning);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-strengthen-phase="FADE"]')).toBeVisible();
  await expect(page.getByLabel("拼写提示")).toHaveText(target.cue);
  await expect(page.getByText(target.lemma, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "试着自己写" }).click();
  await expect(page.locator('[data-strengthen-phase="VERIFY"]')).toBeVisible();
  await expect(page.getByText(target.lemma, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("拼写提示")).toHaveCount(0);
}

async function clickCorrectChoice(page: Page, match: string): Promise<void> {
  const options = page.locator('[role="group"][aria-label="选项"] button');
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const text = await options.nth(index).innerText();
    if (text.includes(match)) {
      await options.nth(index).click();
      return;
    }
  }
  throw new Error(`no Probe option matching ${match}`);
}

async function walkMealFlow(page: Page, prefix: string): Promise<void> {
  await page.goto("/play/context-lab");
  await expect(page.getByRole("heading", { name: "早餐时间" })).toBeVisible();
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-01-ground`);

  await page.getByRole("button", { name: "开始检查" }).click();
  await expect(page.getByText("1 / 5 个物品")).toBeVisible();
  await expect(page.getByLabel("英文答案")).toBeVisible();
  await expect(page.getByText("这个物品对应哪个意思？")).toHaveCount(0);
  await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);
  await assertNoOverflow(page);
  await capture(page, `${prefix}-02-relation`);

  await completeOneTargetWrong(page, 0);
  for (let index = 1; index < 5; index += 1) {
    await completeOneTargetWrong(page, index);
  }
  await expect(page.getByText("建立情境记忆")).toHaveCount(5);
  await assertNoOverflow(page);
  await capture(page, `${prefix}-03-contrast`);

  await page.getByRole("button", { name: "开始建立 5 个词" }).click();
  await expect(page.getByText("教学阶段：建立汤的情境记忆")).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-04-preview`);

  await walkBuildExperience(page, STRENGTHEN_TARGETS[0]);
  await page.getByLabel("英文答案").fill("soup");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, `${prefix}-05-handoff`);
}

test("Context Lab Meal BUILD presentation reaches the assigned frozen task", async ({
  page,
}) => {
  const prohibited = collectProhibited(page);
  const mutations = collectContextLabMutations(page);
  await resetMemoryProbe(page);

  await page.goto("/play/context-lab");
  await expect(page.getByText("早餐时间")).toBeVisible();
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  await expect(page.getByText("汤", { exact: true })).toBeVisible();
  await expect(page.getByText("碗", { exact: true })).toBeVisible();
  await expect(page.getByText("勺子", { exact: true })).toBeVisible();
  await expect(page.getByText("叉子", { exact: true })).toBeVisible();
  await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);

  await completeProbeAllWrong(page);
  await page.getByRole("button", { name: "开始建立 5 个词" }).click();
  await walkBuildExperience(page, STRENGTHEN_TARGETS[0]);

  const input = page.getByLabel("英文答案");
  await expect(input).toBeVisible();
  await input.fill("soup");
  await page.getByRole("button", { name: "提交" }).click();
  const recorded = page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]');
  await expect(recorded).toBeVisible();
  await expect(recorded.getByText("答对了！", { exact: true })).toBeVisible();
  await expect(recorded.getByText("“汤”的这次建立已记录。", { exact: true })).toBeVisible();
  await expect(page.getByText(/已经掌握|永远记住了|学习完成|能力提升/)).toHaveCount(0);

  await assertNoForbiddenPayload(page);
  const evidence = await memoryEvidence(page);
  expect(evidence.evidenceCount).toBe(11);
  expect(evidence.items.some((item) => item.gameId === "RANGER_TRIAL")).toBe(true);

  await page.getByRole("button", { name: "重新体验" }).click();
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();

  expect(prohibited).toEqual([]);
  expect(mutations.length).toBeGreaterThanOrEqual(5);
});

test("Probe is the first stage and does not leak teaching before an answer", async ({
  page,
}) => {
  await page.goto("/play/context-lab");
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);
  await expect(page.getByText(/\/spuːn\/|spoon|掌握|分数/)).toHaveCount(0);
  await page.getByRole("button", { name: "开始检查" }).click();
  await expect(page.getByLabel("英文答案")).toBeVisible();
  await expect(page.locator('[data-presentation-mode="SCENE_TARGET"]')).toBeVisible();
  await expect(page.getByText("这个物品对应哪个意思？")).toHaveCount(0);
  await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);
  await expect(page.locator('[data-presentation-mode="SCENE_TARGET"]')).not.toContainText(
    /\bsoup\b/,
  );
  await assertNoForbiddenPayload(page);
});

for (const target of STRENGTHEN_TARGETS) {
  test(`${target.lemma} BUILD grounds, teaches, fades, and records Evidence`, async ({
    page,
  }) => {
    await resetMemoryProbe(page);
    await page.goto("/play/context-lab");
    await completeProbeStrengthenTargets(
      page,
      STRENGTHEN_TARGETS.map((item) => item.lemma !== target.lemma),
    );
    await expect(page.getByText("建立情境记忆")).toBeVisible();
    await expect(page.getByRole("button", { name: "开始建立 1 个词" })).toBeVisible();
    await page.getByRole("button", { name: "开始建立 1 个词" }).click();
    await walkBuildExperience(page, target);
    const before = await memoryEvidence(page);
    await page.getByLabel("英文答案").fill(target.lemma);
    await page.getByRole("button", { name: "提交" }).click();
    await expect(page.getByText(`“${target.label}”的这次建立已记录。`, { exact: true })).toBeVisible();
    expect((await memoryEvidence(page)).evidenceCount).toBe(before.evidenceCount + 1);
  });
}

test("two BUILD targets stay in scene order", async ({ page }) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await completeProbeStrengthenTargets(page, [false, true, true, false, true]);
  await expect(page.getByRole("button", { name: "开始建立 2 个词" })).toBeVisible();
  await page.getByRole("button", { name: "开始建立 2 个词" }).click();
  await walkBuildExperience(page, STRENGTHEN_TARGETS[0]);
  await page.getByLabel("英文答案").fill("soup");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.getByText("“汤”的这次建立已记录。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "继续下一个" }).click();
  await walkBuildExperience(page, STRENGTHEN_TARGETS[3]);
  await page.getByLabel("英文答案").fill("fork");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.getByText("本次需要建立的词已经完成。", { exact: true })).toBeVisible();
});

test("recognition wrong routes BUILD and all four targets can enter teaching", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await completeProbeAllWrong(page);
  await expect(page.getByText("建立情境记忆")).toHaveCount(5);
  await page.getByRole("button", { name: "开始建立 5 个词" }).click();
  await expect(page.getByText("教学阶段：建立汤的情境记忆")).toBeVisible();
});

test("recall wrong plus recognition correct routes STRENGTHEN", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "开始检查" }).click();
  await page.getByLabel("英文答案").fill("nope");
  await page.getByRole("button", { name: "提交" }).click();
  await expectNeutralProbeRecorded(page);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("soup", { exact: true })).toBeVisible();
  await expect(page.getByLabel("早餐桌上的物品")).toHaveCount(0);
  await clickCorrectChoice(page, "汤");
  await expectNeutralProbeRecorded(page);
  await page.getByRole("button", { name: "继续" }).click();
  for (let index = 1; index < 4; index += 1) {
    await completeOneTargetWrong(page, index);
  }
  await page.getByLabel("英文答案").fill("cup");
  await page.getByRole("button", { name: "提交" }).click();
  await expectNeutralProbeRecorded(page);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("加强记忆连接")).toBeVisible();
  await expect(page.getByText("建立情境记忆")).toHaveCount(3);
});

async function completeProbeSpoonStrengthen(page: Page): Promise<void> {
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "开始检查" }).click();
  await completeOneTargetWrong(page, 0);
  await completeOneTargetWrong(page, 1);
  await expect(page.getByText("3 / 5 个物品")).toBeVisible();
  await page.getByLabel("英文答案").fill("nope");
  await page.getByRole("button", { name: "提交" }).click();
  await expectNeutralProbeRecorded(page);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("spoon", { exact: true })).toBeVisible();
  await clickCorrectChoice(page, "匙");
  await expectNeutralProbeRecorded(page);
  await page.getByRole("button", { name: "继续" }).click();
  await completeOneTargetWrong(page, 3);
  await page.getByLabel("英文答案").fill("cup");
  await page.getByRole("button", { name: "提交" }).click();
  await expectNeutralProbeRecorded(page);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("加强记忆连接")).toBeVisible();
  await expect(page.getByText("建立情境记忆")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "开始强化 1 个词" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始建立 3 个词" })).toBeVisible();
}

test("spoon STRENGTHEN reconnects the form, fades it, then records assisted verification", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await completeProbeSpoonStrengthen(page);
  await expect(page.getByRole("button", { name: "开始强化 1 个词" })).toBeVisible();
  await page.getByRole("button", { name: "开始强化 1 个词" }).click();
  await expect(page.getByText("强化阶段：加强勺子的记忆连接")).toBeVisible();
  await expect(page.getByText("教学阶段：建立勺子的情境记忆")).toHaveCount(0);
  await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);
  await expect(page.getByText("spoon", { exact: true })).toBeVisible();
  await expect(page.getByText("匙，调羹")).toBeVisible();
  await assertNoOverflow(page);

  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-strengthen-phase="FADE"]')).toBeVisible();
  await expect(page.getByLabel("拼写提示")).toHaveText("s _ _ _ _");
  await expect(page.getByText("spoon", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "试着自己写" }).click();
  await expect(page.locator('[data-strengthen-phase="VERIFY"]')).toBeVisible();
  await expect(page.getByText("spoon", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("拼写提示")).toHaveCount(0);
  const before = await memoryEvidence(page);
  await page.getByLabel("英文答案").fill("spoon");
  await page.getByRole("button", { name: "提交" }).dblclick();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  await expect(page.getByText("这次是在提示后答对的。", { exact: true })).toBeVisible();
  await expect(page.getByText("“勺子”的这次强化已记录。", { exact: true })).toBeVisible();
  await expect(page.getByText("本次需要强化的词已经完成。", { exact: true })).toBeVisible();
  await expect(page.getByText("完全独立")).toHaveCount(0);
  await expect(page.getByText("永久掌握")).toHaveCount(0);
  const after = await memoryEvidence(page);
  expect(after.evidenceCount).toBe(before.evidenceCount + 1);
  expect(after.items.some((item) => item.outcome === "ASSISTED_CORRECT")).toBe(true);
  await assertNoForbiddenPayload(page);
  const html = await page.content();
  expect(html).not.toContain('"hintCount"');
});

test("strengthen incorrect verification writes INCORRECT and READY has no plan button", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await completeProbeSpoonStrengthen(page);
  await page.getByRole("button", { name: "开始强化 1 个词" }).click();
  await page.getByRole("button", { name: "继续" }).click();
  await page.getByRole("button", { name: "试着自己写" }).click();
  const before = await memoryEvidence(page);
  await page.getByLabel("英文答案").fill("fork");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  await expect(page.getByText("“勺子”的这次强化已记录。", { exact: true })).toBeVisible();
  expect((await memoryEvidence(page)).evidenceCount).toBe(before.evidenceCount + 1);
  expect((await memoryEvidence(page)).items.some((item) => item.outcome === "INCORRECT")).toBe(true);

  await page.getByRole("button", { name: "重新体验" }).click();
  await page.getByRole("button", { name: "开始检查" }).click();
  for (const lemma of PROBE_LEMMAS) {
    await page.getByLabel("英文答案").fill(lemma);
    await page.getByRole("button", { name: "提交" }).click();
    await expectNeutralProbeRecorded(page);
    await page.getByRole("button", { name: "继续" }).click();
  }
  await expect(page.getByText("本次已能独立回答")).toHaveCount(5);
  await expect(page.getByRole("button", { name: /开始建立/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "开始强化 1 个词" })).toHaveCount(0);
});

test("independent recall routes READY and skips recognition", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await page.getByRole("button", { name: "开始检查" }).click();
  for (const lemma of PROBE_LEMMAS) {
    await expect(page.getByLabel("英文答案")).toBeVisible();
    await page.getByLabel("英文答案").fill(lemma);
    await page.getByRole("button", { name: "提交" }).click();
    await expectNeutralProbeRecorded(page);
    await page.getByRole("button", { name: "继续" }).click();
  }
  await expect(page.getByText("本次已能独立回答")).toHaveCount(5);
  await expect(page.getByRole("button", { name: /开始建立/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "开始强化 1 个词" })).toHaveCount(0);
});

test("Context Lab uses one start and one acknowledgement per Guided step", async ({
  page,
}) => {
  const mutations = collectContextLabMutations(page);
  await page.goto("/play/context-lab");
  await completeProbeAllWrong(page);
  await page.getByRole("button", { name: "开始建立 5 个词" }).click();
  await expect(page.getByText("1 / 6")).toBeVisible();
  const afterHandoff = mutations.length;
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("2 / 6")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("3 / 6")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("4 / 6")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("5 / 6")).toBeVisible();
  await page.getByRole("button", { name: "试着自己写" }).click();
  await expect(page.getByLabel("英文答案")).toBeVisible();
  expect(mutations.length - afterHandoff).toBe(5);
});

test("correct and incorrect BUILD submissions each write one extra Evidence", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await walkGuidedToPreview(page);
  const afterProbe = await memoryEvidence(page);
  await page.getByLabel("英文答案").fill("soup");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  expect((await memoryEvidence(page)).evidenceCount).toBe(afterProbe.evidenceCount + 1);

  await page.getByRole("button", { name: "重新体验" }).click();
  await walkGuidedToPreview(page);
  const beforeWrong = await memoryEvidence(page);
  await page.getByLabel("英文答案").fill("fork");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
  const afterIncorrect = await memoryEvidence(page);
  expect(afterIncorrect.evidenceCount).toBe(beforeWrong.evidenceCount + 1);
  expect(afterIncorrect.items.some((item) => item.outcome === "INCORRECT")).toBe(true);
});

test("duplicate click writes one Evidence", async ({ page }) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await page.getByRole("button", { name: "开始检查" }).click();
  await page.getByLabel("英文答案").fill("nope");
  await page.getByRole("button", { name: "提交" }).dblclick();
  await expectNeutralProbeRecorded(page);
  expect((await memoryEvidence(page)).evidenceCount).toBe(1);
});

test("refresh after submit does not duplicate Evidence and starts a new run", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await page.getByRole("button", { name: "开始检查" }).click();
  await page.getByLabel("英文答案").fill("nope");
  await page.getByRole("button", { name: "提交" }).click();
  await expectNeutralProbeRecorded(page);
  expect((await memoryEvidence(page)).evidenceCount).toBe(1);
  await page.reload();
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  expect((await memoryEvidence(page)).evidenceCount).toBe(1);
});

test("refresh starts a new experimental Probe run", async ({ page }) => {
  await page.goto("/play/context-lab");
  await page.getByRole("button", { name: "开始检查" }).click();
  await expect(page.getByText("1 / 5 个物品")).toBeVisible();
  await page.reload();
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  await expect(
    page.getByText("桌上有几件早餐物品。先检查，教学还没开始。", { exact: true }),
  ).toBeVisible();
});

test("refresh restores the current BUILD target and step", async ({ page }) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await completeProbeAllWrong(page);
  await page.getByRole("button", { name: "开始建立 5 个词" }).click();
  await expect(page.getByText("教学阶段：建立汤的情境记忆")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-build-phase="CONNECT"]')).toBeVisible();
  await page.reload();
  await expect(page.getByText("教学阶段：建立汤的情境记忆")).toBeVisible();
  await expect(page.locator('[data-build-phase="CONNECT"]')).toBeVisible();
  await expect(page.getByText("2 / 6")).toBeVisible();
  await expect(page.getByText("教学阶段：建立碗的情境记忆")).toHaveCount(0);
});

test("rapid double-click does not skip a Guided step", async ({ page }) => {
  await page.goto("/play/context-lab");
  await completeProbeAllWrong(page);
  await page.getByRole("button", { name: "开始建立 5 个词" }).click();
  await expect(page.getByText("1 / 6")).toBeVisible();
  const next = page.getByRole("button", { name: "继续" });
  await next.dblclick();
  await expect(page.getByText("2 / 6")).toBeVisible();
  await expect(page.getByText("3 / 6")).toHaveCount(0);
});

for (const target of STRENGTHEN_TARGETS.filter((item) => item.lemma !== "spoon")) {
  test(`${target.lemma} STRENGTHEN reconnects, fades, and records assisted verification`, async ({
    page,
  }) => {
    await resetMemoryProbe(page);
    await page.goto("/play/context-lab");
    await completeProbeStrengthenTargets(
      page,
      STRENGTHEN_TARGETS.map((item) => item.lemma === target.lemma),
    );
    await page.getByRole("button", { name: "开始强化 1 个词" }).click();
    await walkStrengthenExperience(page, target);
    const before = await memoryEvidence(page);
    await page.getByLabel("英文答案").fill(target.lemma);
    await page.getByRole("button", { name: "提交" }).dblclick();
    await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
    await expect(page.getByText("这次是在提示后答对的。", { exact: true })).toBeVisible();
    await expect(page.getByText(`“${target.label}”的这次强化已记录。`, { exact: true })).toBeVisible();
    const after = await memoryEvidence(page);
    expect(after.evidenceCount).toBe(before.evidenceCount + 1);
    expect(after.items.some((item) => item.outcome === "ASSISTED_CORRECT")).toBe(true);
  });
}

test("two STRENGTHEN targets stay in scene order and cannot be skipped", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await completeProbeStrengthenTargets(page, [true, true, false, false]);
  await expect(page.getByRole("button", { name: "开始强化 2 个词" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始建立 2 个词" })).toBeVisible();
  await expect(page.getByText("建立记忆体验尚未实现")).toHaveCount(0);
  await page.getByRole("button", { name: "开始强化 2 个词" }).click();
  await walkStrengthenExperience(page, STRENGTHEN_TARGETS[0]);
  const before = await memoryEvidence(page);
  await page.getByLabel("英文答案").fill("soup");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.getByText("“汤”的这次强化已记录。", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "继续下一个" })).toBeVisible();
  const afterSoup = await memoryEvidence(page);
  const soupEvidence = afterSoup.items.find((item) => item.outcome === "ASSISTED_CORRECT");
  expect(soupEvidence?.lexemeId).toBeTruthy();
  await page.reload();
  await expect(page.getByText("“汤”的这次强化已记录。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "继续下一个" }).click();
  await expect(page.getByText("强化阶段：加强碗的记忆连接")).toBeVisible();
  await walkStrengthenExperience(page, STRENGTHEN_TARGETS[1]);
  await page.getByLabel("英文答案").fill("bowl");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.getByText("“碗”的这次强化已记录。", { exact: true })).toBeVisible();
  await expect(page.getByText("本次需要强化的词已经完成。", { exact: true })).toBeVisible();
  const after = await memoryEvidence(page);
  expect(after.evidenceCount).toBe(before.evidenceCount + 2);
  const strengthened = after.items.filter((item) => item.outcome === "ASSISTED_CORRECT");
  expect(new Set(strengthened.map((item) => item.lexemeId)).size).toBe(2);
});

test("mixed summary keeps BUILD and STRENGTHEN as separate operations", async ({
  page,
}) => {
  await resetMemoryProbe(page);
  await page.goto("/play/context-lab");
  await completeProbeStrengthenTargets(page, [true, false, false, false]);
  await expect(page.getByRole("button", { name: "开始强化 1 个词" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始建立 3 个词" })).toBeVisible();
  await page.getByRole("button", { name: "开始建立 3 个词" }).click();
  await expect(page.getByText("教学阶段：建立碗的情境记忆")).toBeVisible();
});

for (const viewport of VIEWPORTS) {
  test(`Context Lab strengthen layout has no overflow at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await resetMemoryProbe(page);
    await page.goto("/play/context-lab");
    await completeProbeSpoonStrengthen(page);
    await page.getByRole("button", { name: "开始强化 1 个词" }).click();
    await expect(page.getByText("强化阶段：加强勺子的记忆连接")).toBeVisible();
    await assertNoOverflow(page);
    await page.getByRole("button", { name: "继续" }).click();
    await expect(page.locator('[data-strengthen-phase="FADE"]')).toBeVisible();
    await assertNoOverflow(page);
    await page.getByRole("button", { name: "试着自己写" }).click();
    await expect(page.locator('[data-strengthen-phase="VERIFY"]')).toBeVisible();
    await assertNoOverflow(page);
  });
}

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
  await expect(page.getByRole("button", { name: "开始检查" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("英文答案")).toBeVisible();
  await completeOneTargetWrong(page, 0);
  for (let index = 1; index < 5; index += 1) {
    await completeOneTargetWrong(page, index);
  }
  await page.getByRole("button", { name: "开始建立 5 个词" }).press("Enter");
  await expect(page.getByText("教学阶段：建立汤的情境记忆")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).press("Enter");
  await expect(page.locator('[data-build-phase="CONNECT"]')).toBeVisible();
  await page.getByRole("button", { name: "继续" }).press("Space");
  await expect(page.locator('[data-support-kind="LEXICAL_FORM"]')).toBeVisible();
  await page.getByRole("button", { name: "继续" }).press("Enter");
  await expect(page.locator('[data-build-phase="CONTRAST"]')).toBeVisible();
  await page.getByRole("button", { name: "继续" }).press("Enter");
  await expect(page.locator('[data-build-phase="FADE"]')).toBeVisible();
  await page.getByRole("button", { name: "试着自己写" }).press("Enter");
  await expect(page.getByLabel("英文答案")).toBeVisible();
  await page.getByLabel("英文答案").fill("soup");
  await page.getByLabel("英文答案").press("Enter");
  await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
});

test("reduced-motion browser context can complete the flow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/context-lab");
  await completeProbeAllWrong(page);
  await page.getByRole("button", { name: "开始建立 5 个词" }).click();
  await walkBuildExperience(page, STRENGTHEN_TARGETS[0]);
  await page.getByLabel("英文答案").fill("soup");
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
    ["next", "start", "--hostname", "127.0.0.1", "--port", "3320"],
    {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  disabledServer = child;
  const started = await waitForServer("http://127.0.0.1:3320", child);
  if (!started) {
    stopDisabledContextLab();
    throw new Error(
      "Disabled Context Lab server did not become ready on 127.0.0.1:3320",
    );
  }
  return "http://127.0.0.1:3320";
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
