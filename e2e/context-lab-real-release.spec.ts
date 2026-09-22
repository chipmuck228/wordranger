import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page, type Request } from "@playwright/test";
import { chromium } from "playwright";

const REAL_RELEASE_GATE = process.env.CONTEXT_LAB_REAL_RELEASE_E2E === "1";
const EXPECTED_RELEASE_ID = "meal-release-migration-v0";
const EXPECTED_FINGERPRINT =
  "5f8e38fe698f8bc4a30b0a64df6d0c1b7939e19c10619afd3b876eba8ff8b93f";
const POINTER_PATH = "docs/contextual-content-releases/pointer-meal-scene-v0.json";
const MANIFEST_PATH = "docs/contextual-content-releases/meal-release-migration-v0.json";
const QA_DIR = "test-results/context-lab-real-release-qa";

const PROBE_TARGETS = [
  { token: "soup", label: "汤", lemma: "soup", avoid: "汤", cue: "s _ _ _" },
  { token: "bowl", label: "碗", lemma: "bowl", avoid: "碗", cue: "b _ _ _" },
  { token: "spoon", label: "勺子", lemma: "spoon", avoid: "匙", cue: "s _ _ _ _" },
  { token: "fork", label: "叉子", lemma: "fork", avoid: "叉", cue: "f _ _ _" },
  { token: "cup", label: "杯子", lemma: "cup", avoid: "杯", cue: "c _ _" },
  { token: "plate", label: "盘子", lemma: "plate", avoid: "盘子", cue: "p _ _ _ _" },
  {
    token: "knife",
    label: "小刀",
    lemma: "knife",
    avoid: "小刀",
    cue: "k _ _ _ _",
  },
  { token: "bread", label: "面包", lemma: "bread", avoid: "面包", cue: "b _ _ _ _" },
  { token: "water", label: "水", lemma: "water", avoid: "水", cue: "w _ _ _ _" },
] as const;

const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

const FORBIDDEN_UI = [
  "CognitiveMode",
  "disposition",
  "LearningEvidence",
  "Candidate",
  "releaseFingerprint",
  "AnswerKey",
] as const;

const FORBIDDEN_POST_KEYS =
  /"userId"|"releaseId"|"contentReleaseId"|"targetIndex"|"disposition"|"hintCount"|"answerKey"|"correctOptionIds"/;

const PROHIBITED_URL =
  /\/train(?:\/|$|\?)|\/play\/ranger-trial|\/play\/word-bubble|\/play\/matching|\/play\/snake|submit-task|supabase\.co|learning_evidence|student_lexeme/i;

type ProbeRoute = "READY" | "STRENGTHEN" | "BUILD";

test.describe("nine-word human active-release Chromium acceptance", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(() => {
    if (!REAL_RELEASE_GATE) {
      test.skip(
        true,
        "CONTEXT_LAB_REAL_RELEASE_E2E is unset; skip instead of synthetic pass",
      );
    }
    if (
      process.env.VERCEL_ENV === "production" ||
      process.env.VERCEL_ENV === "preview"
    ) {
      throw new Error(
        "CONTEXT_LAB_REAL_RELEASE_E2E is forbidden on production/preview hosts",
      );
    }
    assertChromiumAvailable();
    assertHumanArtifacts();
  });

  test("Probe nine words, water READY, bread STRENGTHEN, knife BUILD, queue, refresh, network", async ({
    page,
  }) => {
    const network = attachNetworkWatch(page);
    await resetMemoryProbe(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/play/context-lab");

    await expect(page.getByRole("heading", { name: "早餐时间" })).toBeVisible();
    await expect(page.getByText("PLAN_NO_COMPATIBLE_VARIANT")).toHaveCount(0);
    await expect(page.getByText("CONTEXT_LAB_CONTENT_UNAVAILABLE")).toHaveCount(0);
    await expect(page.getByTestId("context-lab-content-pin")).toHaveText(
      EXPECTED_RELEASE_ID,
    );
    for (const target of PROBE_TARGETS) {
      await expect(page.getByText(target.label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);
    await expectNoInternalLeak(page);
    await capture(page, "1440x900-01-probe-scene");

    await page.getByRole("button", { name: "开始检查" }).click();
    const observedOrder: string[] = [];
    const routes: Record<(typeof PROBE_TARGETS)[number]["token"], ProbeRoute> = {
      soup: "READY",
      bowl: "READY",
      spoon: "READY",
      fork: "BUILD",
      cup: "READY",
      plate: "READY",
      knife: "BUILD",
      bread: "STRENGTHEN",
      water: "READY",
    };

    for (let index = 0; index < PROBE_TARGETS.length; index += 1) {
      const target = PROBE_TARGETS[index]!;
      await expect(page.getByText(`${index + 1} / 9 个物品`)).toBeVisible();
      await expect(page.locator('[data-presentation-mode="SCENE_TARGET"]')).toBeVisible();
      await expect(page.getByLabel("英文答案")).toBeVisible();
      const recallText = await page
        .locator('[data-presentation-mode="SCENE_TARGET"]')
        .innerText();
      expect(recallText).not.toMatch(new RegExp(`\\b${target.lemma}\\b`, "i"));
      expect(recallText).not.toMatch(/knives/i);
      if (target.token === "knife") {
        await capture(page, "1440x900-02-knife-recall");
      }
      observedOrder.push(target.token);

      if (routes[target.token] === "READY") {
        await page.getByLabel("英文答案").fill(target.lemma);
        await page.getByRole("button", { name: "提交" }).click();
        await expectNeutralProbeRecorded(page);
        await page.getByRole("button", { name: "继续" }).click();
        continue;
      }

      await page.getByLabel("英文答案").fill("nope");
      await page.getByRole("button", { name: "提交" }).click();
      await expectNeutralProbeRecorded(page);
      await page.getByRole("button", { name: "继续" }).click();
      await expect(page.locator('[data-presentation-mode="TASK_ONLY"]')).toBeVisible();
      await expect(page.getByLabel("早餐桌上的物品")).toHaveCount(0);
      if (target.token === "knife") {
        await expect(page.getByText(/knife/i).first()).toBeVisible();
        await capture(page, "1440x900-03-knife-recognition");
      }
      if (routes[target.token] === "STRENGTHEN") {
        await clickChoice(page, target.avoid, true);
      } else {
        await clickChoice(page, target.avoid, false);
      }
      await expectNeutralProbeRecorded(page);
      await page.getByRole("button", { name: "继续" }).click();
    }

    expect(observedOrder).toEqual(PROBE_TARGETS.map((item) => item.token));
    writeJson("probe-order.json", { observedOrder });

    await expect(page.getByText("本次已能独立回答")).toHaveCount(6);
    await expect(
      page.locator("li").filter({ hasText: "水" }).filter({ hasText: "本次已能独立回答" }),
    ).toBeVisible();
    await expect(
      page.locator("li").filter({ hasText: "面包" }).filter({ hasText: "加强记忆连接" }),
    ).toBeVisible();
    await expect(
      page.locator("li").filter({ hasText: "小刀" }).filter({ hasText: "建立情境记忆" }),
    ).toBeVisible();
    await expect(page.getByText("建立情境记忆")).toHaveCount(2);
    await expect(page.getByText("加强记忆连接")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "开始建立 2 个词" })).toBeVisible();
    await expect(page.getByRole("button", { name: "开始强化 1 个词" })).toBeVisible();
    await expect(page.getByText("不是永久掌握程度")).toBeVisible();
    await expect(page.getByText(/已经掌握|永远记住了|学习完成|能力提升/)).toHaveCount(0);
    await expectNoInternalLeak(page);
    await capture(page, "1440x900-04-probe-summary");

    const afterProbe = await memoryEvidence(page);
    expect(afterProbe.evidenceCount).toBe(12);

    await page.getByRole("button", { name: "开始建立 2 个词" }).click();
    await expect(page.getByText("教学阶段：建立叉子的情境记忆")).toBeVisible();
    expect(await memoryEvidence(page)).toMatchObject({
      evidenceCount: afterProbe.evidenceCount,
    });
    await walkBuildToVerify(page, PROBE_TARGETS[3]!);
    await page.getByLabel("英文答案").fill("fork");
    await page.getByRole("button", { name: "提交" }).click();
    await expect(page.getByText("“叉子”的这次建立已记录。", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "继续下一个" }).click();

    await expect(page.getByText("教学阶段：建立小刀的情境记忆")).toBeVisible();
    await expect(page.getByTestId("context-lab-content-pin")).toHaveText(
      EXPECTED_RELEASE_ID,
    );
    await expect(page.getByText("教学阶段：建立勺子的情境记忆")).toHaveCount(0);
    await expect(page.locator('[data-build-phase="GROUND"]')).toBeVisible();
    await page.getByRole("button", { name: "继续" }).click();
    await expect(page.locator('[data-build-phase="CONNECT"]')).toBeVisible();
    await expect(page.getByText("这把小刀适合切开面包", { exact: true })).toBeVisible();
    await expect(page.getByText("这件餐具适合切开固体食物。", { exact: true })).toBeVisible();
    await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);
    await page.getByRole("button", { name: "继续" }).click();
    const knifeReveal = page.locator('[data-support-kind="LEXICAL_FORM"]');
    await expect(knifeReveal).toBeVisible();
    await expect(knifeReveal).toContainText("knife");
    await expect(knifeReveal).toContainText("小刀");
    await expect(knifeReveal).toContainText("复数 knives");
    await expect(knifeReveal).not.toContainText("knife(pl.knives)");
    await page.getByRole("button", { name: "继续" }).click();
    await expect(page.locator('[data-build-phase="CONTRAST"]')).toBeVisible();
    await expect(page.getByText("小刀：切开固体食物", { exact: true })).toBeVisible();
    await expect(
      page.getByText("比较一下这把小刀和叉子：它们切开食物和叉起食物的方式有什么不同？", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);
    await capture(page, "1440x900-05-knife-build-contrast");
    expect(await memoryEvidence(page)).toMatchObject({
      evidenceCount: afterProbe.evidenceCount + 1,
    });

    await page.reload();
    await expect(page.getByText("教学阶段：建立小刀的情境记忆")).toBeVisible();
    await expect(page.locator('[data-build-phase="CONTRAST"]')).toBeVisible();
    await expect(page.getByTestId("context-lab-content-pin")).toHaveText(
      EXPECTED_RELEASE_ID,
    );
    expect(await memoryEvidence(page)).toMatchObject({
      evidenceCount: afterProbe.evidenceCount + 1,
    });

    await page.getByRole("button", { name: "继续" }).click();
    await expect(page.locator('[data-build-phase="FADE"]')).toBeVisible();
    await expect(page.getByLabel("拼写提示")).toHaveText(PROBE_TARGETS[6]!.cue);
    await capture(page, "1440x900-knife-fade-cue");
    await page.getByRole("button", { name: "试着自己写" }).click();
    await expect(page.getByLabel("英文答案")).toBeVisible();
    await capture(page, "1440x900-07-knife-frozen-verify");
    const beforeKnifeFrozen = await memoryEvidence(page);
    await page.getByLabel("英文答案").fill("knife");
    await page.getByRole("button", { name: "提交" }).dblclick();
    await expect(page.locator('[data-pilot-state="FROZEN_TASK_RECORDED"]')).toBeVisible();
    await expect(page.getByText("“小刀”的这次建立已记录。", { exact: true })).toBeVisible();
    await expect(page.getByText("本次需要建立的词已经完成。", { exact: true })).toBeVisible();
    const afterKnifeFrozen = await memoryEvidence(page);
    expect(afterKnifeFrozen.evidenceCount).toBe(beforeKnifeFrozen.evidenceCount + 1);
    const knifeFrozenEvidence = afterKnifeFrozen.items.find(
      (item) =>
        !beforeKnifeFrozen.items.some(
          (previous) => previous.taskId === item.taskId && previous.sessionId === item.sessionId,
        ),
    );
    expect(knifeFrozenEvidence?.outcome).toBe("INDEPENDENT_CORRECT");

    await page.reload();
    await expect(page.getByText("“小刀”的这次建立已记录。", { exact: true })).toBeVisible();
    expect((await memoryEvidence(page)).evidenceCount).toBe(
      afterKnifeFrozen.evidenceCount,
    );
    await capture(page, "1440x900-08-knife-recorded");

    await page.getByRole("button", { name: "回到这次检查" }).click();
    await expect(page.getByRole("button", { name: "开始强化 1 个词" })).toBeVisible();
    await page.getByRole("button", { name: "开始强化 1 个词" }).click();
    await expect(page.getByText("强化阶段：加强面包的记忆连接")).toBeVisible();
    await expect(page.getByText("教学阶段：建立面包的情境记忆")).toHaveCount(0);
    await expect(page.getByText("勺子 → 适合舀汤")).toHaveCount(0);
    const breadReveal = page.locator('[data-support-kind="LEXICAL_FORM"]');
    await expect(breadReveal).toContainText("bread");
    await expect(breadReveal).toContainText("面包");
    await capture(page, "1440x900-06-bread-strengthen-reconnect");
    const beforeBreadGuided = await memoryEvidence(page);
    await page.getByRole("button", { name: "继续" }).click();
    await expect(page.locator('[data-strengthen-phase="FADE"]')).toBeVisible();
    await expect(page.getByLabel("拼写提示")).toHaveText("b _ _ _ _");
    await expect(page.getByText("bread", { exact: true })).toHaveCount(0);
    expect((await memoryEvidence(page)).evidenceCount).toBe(beforeBreadGuided.evidenceCount);
    await page.getByRole("button", { name: "试着自己写" }).click();
    await page.getByLabel("英文答案").fill("bread");
    await page.getByRole("button", { name: "提交" }).dblclick();
    await expect(page.getByText("“面包”的这次强化已记录。", { exact: true })).toBeVisible();
    await expect(page.getByText("本次需要强化的词已经完成。", { exact: true })).toBeVisible();
    await expect(page.getByText(/已经掌握|永远记住了|学习完成|能力提升/)).toHaveCount(0);
    const afterBread = await memoryEvidence(page);
    expect(afterBread.evidenceCount).toBe(beforeBreadGuided.evidenceCount + 1);
    await capture(page, "1440x900-08-queue-complete");

    await expectNoInternalLeak(page);
    expect(network.prohibited).toEqual([]);
    expect(network.unsafePosts).toEqual([]);
    writeJson("network-watch.json", network);
    writeJson("evidence.json", {
      afterProbe: afterProbe.evidenceCount,
      afterKnifeFrozen: afterKnifeFrozen.evidenceCount,
      knifeFrozenOutcome: knifeFrozenEvidence?.outcome,
      afterBread: afterBread.evidenceCount,
    });

    const pointer = readPointer();
    expect(pointer.releaseId).toBe(EXPECTED_RELEASE_ID);
    expect(pointer.releaseFingerprint).toBe(EXPECTED_FINGERPRINT);
  });

  test("Probe-page refresh starts a new run; Guided recovery restores the pinned run", async ({
    page,
  }) => {
    await resetMemoryProbe(page);
    await page.goto("/play/context-lab");
    await expect(page.getByTestId("context-lab-content-pin")).toHaveText(
      EXPECTED_RELEASE_ID,
    );
    await page.getByRole("button", { name: "开始检查" }).click();
    await expect(page.getByText("1 / 9 个物品")).toBeVisible();
    await page.reload();
    await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
    await expect(page.getByText("桌上有几件早餐物品。先检查，教学还没开始。")).toBeVisible();
    await expect(page.getByTestId("context-lab-content-pin")).toHaveText(
      EXPECTED_RELEASE_ID,
    );

    await completeReadyExcept(page, { fork: "BUILD", knife: "BUILD" });
    await page.getByRole("button", { name: "开始建立 2 个词" }).click();
    await expect(page.getByText("教学阶段：建立叉子的情境记忆")).toBeVisible();
    await page.getByRole("button", { name: "继续" }).click();
    await expect(page.locator('[data-build-phase="CONNECT"]')).toBeVisible();
    const storedRunId = await page.evaluate(() =>
      window.sessionStorage.getItem("context-lab-strengthen-run"),
    );
    expect(storedRunId).toBeTruthy();
    await page.reload();
    await expect(page.getByText("教学阶段：建立叉子的情境记忆")).toBeVisible();
    await expect(page.locator('[data-build-phase="CONNECT"]')).toBeVisible();
    const restoredRunId = await page.evaluate(() =>
      window.sessionStorage.getItem("context-lab-strengthen-run"),
    );
    expect(restoredRunId).toBe(storedRunId);
    await expect(page.getByTestId("context-lab-content-pin")).toHaveText(
      EXPECTED_RELEASE_ID,
    );
  });

  test("three viewports capture Probe, knife, bread, frozen, and completion stages", async ({
    page,
  }) => {
    for (const viewport of VIEWPORTS) {
      await resetMemoryProbe(page);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/context-lab");
      await expect(page.getByRole("heading", { name: "早餐时间" })).toBeVisible();
      await assertNoOverflow(page);
      await assertPrimaryButtonVisible(page, "开始检查");
      await captureSceneMetrics(page, `${viewport.name}-probe-scene`);
      await capture(page, `${viewport.name}-01-probe-scene`);

      await completeReadyExcept(page, {
        knife: "BUILD",
        bread: "STRENGTHEN",
      });
      await expect(page.getByText("建立情境记忆")).toBeVisible();
      await assertNoOverflow(page);
      await capture(page, `${viewport.name}-04-probe-summary`);
      await assertPrimaryButtonVisible(page, "开始建立 1 个词");

      await page.getByRole("button", { name: "开始建立 1 个词" }).click();
      await expect(page.getByText("教学阶段：建立小刀的情境记忆")).toBeVisible();
      await page.getByRole("button", { name: "继续" }).click();
      await page.getByRole("button", { name: "继续" }).click();
      await page.getByRole("button", { name: "继续" }).click();
      await expect(page.locator('[data-build-phase="CONTRAST"]')).toBeVisible();
      await assertNoOverflow(page);
      await capture(page, `${viewport.name}-05-knife-build-contrast`);
      await page.getByRole("button", { name: "继续" }).click();
      await expect(page.locator('[data-build-phase="FADE"]')).toBeVisible();
      await expect(page.getByLabel("拼写提示")).toHaveText("k _ _ _ _");
      await capture(page, `${viewport.name}-knife-fade-cue`);
      await page.getByRole("button", { name: "试着自己写" }).click();
      await assertPrimaryButtonVisible(page, "提交");
      await capture(page, `${viewport.name}-07-frozen-verify`);
      await page.getByLabel("英文答案").fill("knife");
      await page.getByRole("button", { name: "提交" }).click();
      await expect(page.getByText("“小刀”的这次建立已记录。", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "回到这次检查" }).click();
      await page.getByRole("button", { name: "开始强化 1 个词" }).click();
      await expect(page.getByText("强化阶段：加强面包的记忆连接")).toBeVisible();
      await assertNoOverflow(page);
      await capture(page, `${viewport.name}-06-bread-strengthen`);
      await page.getByRole("button", { name: "继续" }).click();
      await page.getByRole("button", { name: "试着自己写" }).click();
      await page.getByLabel("英文答案").fill("bread");
      await page.getByRole("button", { name: "提交" }).click();
      await expect(page.getByText("本次需要强化的词已经完成。", { exact: true })).toBeVisible();
      await capture(page, `${viewport.name}-08-queue-complete`);
    }
  });

  test("/train stays isolated from the nine-word contextual release", async ({
    page,
  }) => {
    const releaseReads: string[] = [];
    page.on("request", (request) => {
      if (
        /contextual-content-releases|meal-release-migration-v0|pointer-meal-scene-v0/.test(
          request.url(),
        )
      ) {
        releaseReads.push(request.url());
      }
    });
    const response = await page.goto("/train");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText("PLAN_NO_COMPATIBLE_VARIANT")).toHaveCount(0);
    expect(releaseReads).toEqual([]);
  });
});

function assertChromiumAvailable(): void {
  const executable = chromium.executablePath();
  if (!executable || !existsSync(executable)) {
    throw new Error("Chromium executable missing; real acceptance cannot pass");
  }
}

function assertHumanArtifacts(): void {
  if (!existsSync(POINTER_PATH) || !existsSync(MANIFEST_PATH)) {
    throw new Error("HUMAN_RUNTIME_ARTIFACTS_UNAVAILABLE");
  }
  const pointer = readPointer();
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
    releaseId: string;
    releaseFingerprint: string;
    status: string;
    targetEntries?: unknown[];
  };
  if (
    pointer.releaseId !== EXPECTED_RELEASE_ID ||
    pointer.releaseFingerprint !== EXPECTED_FINGERPRINT ||
    manifest.status !== "PUBLISHED" ||
    (manifest.targetEntries?.length ?? 0) !== 9
  ) {
    throw new Error("HUMAN_RUNTIME_ARTIFACTS_UNAVAILABLE");
  }
}

function readPointer(): { releaseId: string; releaseFingerprint: string } {
  return JSON.parse(readFileSync(POINTER_PATH, "utf8")) as {
    releaseId: string;
    releaseFingerprint: string;
  };
}

function attachNetworkWatch(page: Page): {
  prohibited: string[];
  unsafePosts: string[];
} {
  const prohibited: string[] = [];
  const unsafePosts: string[] = [];
  page.on("request", (request) => {
    if (PROHIBITED_URL.test(request.url())) {
      prohibited.push(request.url());
    }
    if (request.method() === "POST" && isUnsafeContextLabPost(request)) {
      unsafePosts.push(`${request.url()} ${request.postData() ?? ""}`);
    }
  });
  return { prohibited, unsafePosts };
}

function isUnsafeContextLabPost(request: Request): boolean {
  if (!/\/play\/context-lab/.test(request.url())) {
    return false;
  }
  const body = request.postData() ?? "";
  return FORBIDDEN_POST_KEYS.test(body);
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
    outcome: string;
    lexemeId?: string;
    taskId?: string;
    sessionId?: string;
  }>;
}> {
  const response = await page.request.get("/play/context-lab/memory-probe");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function expectNeutralProbeRecorded(page: Page): Promise<void> {
  const recorded = page.locator('[data-pilot-state="PROBE_TASK_RECORDED"]');
  await expect(recorded).toBeVisible();
  await expect(recorded.getByText("这次回答已记录，请继续。")).toBeVisible();
  await expect(recorded.getByText("答对了！")).toHaveCount(0);
}

async function clickChoice(
  page: Page,
  match: string,
  correct: boolean,
): Promise<void> {
  const options = page.locator('[role="group"][aria-label="选项"] button');
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const text = await options.nth(index).innerText();
    if (correct ? text.includes(match) : !text.includes(match)) {
      await options.nth(index).click();
      return;
    }
  }
  if (correct) {
    throw new Error(`no Probe option matching ${match}`);
  }
  await options.last().click();
}

async function walkBuildToVerify(
  page: Page,
  target: (typeof PROBE_TARGETS)[number],
): Promise<void> {
  await expect(page.getByText(`教学阶段：建立${target.label}的情境记忆`)).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-build-phase="CONNECT"]')).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-support-kind="LEXICAL_FORM"]')).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-build-phase="CONTRAST"]')).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.locator('[data-build-phase="FADE"]')).toBeVisible();
  await expect(page.getByLabel("拼写提示")).toHaveText(target.cue);
  await page.getByRole("button", { name: "试着自己写" }).click();
  await expect(page.getByLabel("英文答案")).toBeVisible();
}

async function completeReadyExcept(
  page: Page,
  overrides: Partial<Record<(typeof PROBE_TARGETS)[number]["token"], ProbeRoute>>,
): Promise<void> {
  await expect(page.getByText("先看看你已经会了哪些词", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "开始检查" }).click();
  for (let index = 0; index < PROBE_TARGETS.length; index += 1) {
    const target = PROBE_TARGETS[index]!;
    const route = overrides[target.token] ?? "READY";
    await expect(page.getByText(`${index + 1} / 9 个物品`)).toBeVisible();
    if (target.token === "knife" && route !== "READY") {
      await capture(page, `${await viewportName(page)}-02-knife-recall`);
    }
    if (route === "READY") {
      await page.getByLabel("英文答案").fill(target.lemma);
      await page.getByRole("button", { name: "提交" }).click();
      await expectNeutralProbeRecorded(page);
      await page.getByRole("button", { name: "继续" }).click();
      continue;
    }
    await page.getByLabel("英文答案").fill("nope");
    await page.getByRole("button", { name: "提交" }).click();
    await expectNeutralProbeRecorded(page);
    await page.getByRole("button", { name: "继续" }).click();
    if (target.token === "knife") {
      await capture(page, `${await viewportName(page)}-03-knife-recognition`);
    }
    await clickChoice(page, target.avoid, route === "STRENGTHEN");
    await expectNeutralProbeRecorded(page);
    await page.getByRole("button", { name: "继续" }).click();
  }
}

async function expectNoInternalLeak(page: Page): Promise<void> {
  const html = await page.content();
  for (const term of FORBIDDEN_UI) {
    expect(html, term).not.toContain(term);
  }
  expect(html).not.toMatch(/已经掌握|永远记住了|学习完成|能力提升|掌握度|分数/);
}

async function assertNoOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function assertPrimaryButtonVisible(page: Page, name: string): Promise<void> {
  const button = page.getByRole("button", { name });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  const viewport = page.viewportSize();
  writeJson(`${viewport ? `${viewport.width}x${viewport.height}` : "unknown"}-${name}-button.json`, {
    name,
    box,
    viewport,
    inFirstScreen: Boolean(
      box && viewport && box.y + box.height <= viewport.height + 8,
    ),
  });
}

async function captureSceneMetrics(page: Page, name: string): Promise<void> {
  const metrics = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll("[data-entity-id]")].map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        id: node.getAttribute("data-entity-id"),
        label: node.textContent,
        highlighted: node.getAttribute("data-highlighted") === "true",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
    return {
      tileCount: tiles.length,
      minHeight: Math.min(...tiles.map((tile) => tile.height)),
      minWidth: Math.min(...tiles.map((tile) => tile.width)),
      tiles,
    };
  });
  writeJson(`${name}-metrics.json`, metrics);
}

async function capture(page: Page, name: string): Promise<void> {
  mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({
    path: `${QA_DIR}/${name}.png`,
    fullPage: true,
  });
}

async function viewportName(page: Page): Promise<string> {
  const size = page.viewportSize();
  return size ? `${size.width}x${size.height}` : "unknown";
}

function writeJson(name: string, value: unknown): void {
  mkdirSync(QA_DIR, { recursive: true });
  writeFileSync(`${QA_DIR}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
}
