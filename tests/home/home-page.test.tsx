/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomePage } from "@/components/home/home-page";
import { DAILY_TRAINING_COMPLETED_ROUNDS_KEY } from "@/components/training/training-session-storage";
import { DAILY_TRAINING_HREF } from "@/server/home/resolve-home-learning-paths";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const homeSource = [
  readFileSync("src/app/page.tsx", "utf8"),
  readFileSync("src/components/home/home-page.tsx", "utf8"),
  readFileSync("src/components/home/home-practice-entry.tsx", "utf8"),
].join("\n");

function renderHome() {
  return render(
    <HomePage
      debugTools={[]}
      paths={{
        primaryHref: DAILY_TRAINING_HREF,
      }}
    />,
  );
}

describe("Homepage learning-path presentation", () => {
  it("shows the product claim, free practice, and three steps", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: "让学过的单词，在需要时想得起来" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "自由练习" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "场景学习" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "学习会怎样进行？" })).toBeTruthy();
    expect(
      screen.getByText(
        "随时开始一小组单词练习。系统会安排适合当前练习的单词，你只需要直接选择或输入答案。",
      ),
    ).toBeTruthy();
    expect(screen.getByText("单词由系统根据当前学习情况安排。")).toBeTruthy();
  });

  it("uses 开始自由练习 as the primary entry to /train", () => {
    renderHome();
    const primary = screen.getByRole("link", { name: "开始自由练习" });
    expect(primary.getAttribute("href")).toBe("/train");
    expect(screen.queryByRole("link", { name: "继续今天的学习" })).toBeNull();
  });

  it("keeps 开始自由练习 until a group is completed", () => {
    sessionStorage.setItem("wordranger.daily-training.sessionId", "sess-open");
    renderHome();
    expect(screen.getByRole("link", { name: "开始自由练习" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "继续自由练习" })).toBeNull();
  });

  it("shows 继续自由练习 after a completed group", () => {
    sessionStorage.setItem(DAILY_TRAINING_COMPLETED_ROUNDS_KEY, "1");
    renderHome();
    expect(screen.getByRole("link", { name: "继续自由练习" }).getAttribute("href")).toBe(
      "/train",
    );
    expect(screen.queryByRole("link", { name: "开始自由练习" })).toBeNull();
  });

  it("does not show old game menu items or Debug tools", () => {
    renderHome();
    expect(screen.queryByRole("link", { name: "连连看" })).toBeNull();
    expect(screen.queryByRole("link", { name: "贪食蛇" })).toBeNull();
    expect(screen.queryByRole("link", { name: "单词泡泡" })).toBeNull();
    expect(screen.queryByRole("link", { name: "单词闯关" })).toBeNull();
    expect(screen.queryByText("Debug 工具")).toBeNull();
    expect(screen.queryByRole("link", { name: /debug/i })).toBeNull();
  });

  it("does not invent a free-practice selector", () => {
    renderHome();
    expect(screen.queryByRole("link", { name: "选择练习方式" })).toBeNull();
    expect(screen.queryByRole("button", { name: "选择练习方式" })).toBeNull();
  });

  it("shows scene learning as preparing only", () => {
    renderHome();
    expect(screen.getByRole("status").textContent).toContain("场景学习正在准备中");
    expect(screen.queryByRole("link", { name: "进入场景" })).toBeNull();
    expect(screen.queryByRole("link", { name: /场景/ })).toBeNull();
    expect(homeSource).not.toContain("/play/context-lab");
  });

  it("does not claim a target count or leak internal Candidate data", () => {
    renderHome();
    expect(screen.queryByText(/9 个/)).toBeNull();
    expect(screen.queryByText(/fingerprint/i)).toBeNull();
    expect(screen.queryByText(/AnswerKey/i)).toBeNull();
    expect(screen.queryByText(/ExperienceRun/i)).toBeNull();
    expect(screen.queryByText(/promotion/i)).toBeNull();
    expect(homeSource).not.toContain("AnswerKey");
    expect(homeSource).not.toContain("fingerprint");
    expect(homeSource).not.toContain("HUMAN_REVIEW");
    expect(homeSource).not.toContain("ExperienceRun");
    expect(homeSource).not.toContain("loadContextLabContent");
    expect(homeSource).not.toContain("9 个目标词");
  });

  it("is keyboard reachable for the primary action", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "设置" }));
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "开始自由练习" }),
    );
  });
});
