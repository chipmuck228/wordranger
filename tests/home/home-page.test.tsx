/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomePage } from "@/components/home/home-page";
import { CONTEXT_LAB_HREF, DAILY_TRAINING_HREF } from "@/server/home/resolve-home-learning-paths";

afterEach(() => {
  cleanup();
});

const homeSource = [
  readFileSync("src/app/page.tsx", "utf8"),
  readFileSync("src/components/home/home-page.tsx", "utf8"),
  readFileSync("src/server/home/resolve-home-learning-paths.ts", "utf8"),
].join("\n");

function renderReady() {
  return render(
    <HomePage
      debugTools={[]}
      paths={{
        primaryHref: DAILY_TRAINING_HREF,
        scene: { status: "ready", href: CONTEXT_LAB_HREF },
      }}
    />,
  );
}

function renderPreparing() {
  return render(
    <HomePage
      debugTools={[]}
      paths={{
        primaryHref: DAILY_TRAINING_HREF,
        scene: { status: "preparing" },
      }}
    />,
  );
}

describe("Homepage learning-path presentation", () => {
  it("shows the product claim, both learning paths, and three steps", () => {
    renderReady();
    expect(
      screen.getByRole("heading", { name: "让学过的单词，在需要时想得起来" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "自由练习" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "场景学习" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "学习会怎样进行？" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "先自己想一想" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "找到合适的学习方式" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "再试着回忆一次" })).toBeTruthy();
    expect(screen.getByText(/在场景学习中，已经会的词可以继续前进/)).toBeTruthy();
  });

  it("keeps Daily Training as the primary entry", () => {
    renderReady();
    const primary = screen.getByRole("link", { name: "继续今天的学习" });
    expect(primary.getAttribute("href")).toBe("/train");
  });

  it("does not show old game menu items or Debug tools", () => {
    renderReady();
    expect(screen.queryByRole("link", { name: "连连看" })).toBeNull();
    expect(screen.queryByRole("link", { name: "贪食蛇" })).toBeNull();
    expect(screen.queryByRole("link", { name: "单词泡泡" })).toBeNull();
    expect(screen.queryByRole("link", { name: "单词闯关" })).toBeNull();
    expect(screen.queryByText("Debug 工具")).toBeNull();
    expect(screen.queryByRole("link", { name: /debug/i })).toBeNull();
  });

  it("does not invent a free-practice selector", () => {
    renderReady();
    expect(screen.queryByRole("link", { name: "选择练习方式" })).toBeNull();
    expect(screen.queryByRole("button", { name: "选择练习方式" })).toBeNull();
  });

  it("links to Context Lab only when the projection marks the scene ready", () => {
    renderReady();
    const enter = screen.getByRole("link", { name: "进入场景" });
    expect(enter.getAttribute("href")).toBe("/play/context-lab");
    expect(screen.queryByText("场景学习正在准备中")).toBeNull();
  });

  it("shows a conservative preparing state when the scene is not startable", () => {
    renderPreparing();
    expect(screen.getByRole("status").textContent).toContain("场景学习正在准备中");
    expect(screen.queryByRole("link", { name: "进入场景" })).toBeNull();
    expect(screen.queryByRole("link", { name: /场景/ })).toBeNull();
  });

  it("does not claim a target count or leak internal Candidate data", () => {
    renderReady();
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

  it("is keyboard reachable for the primary and scene actions", async () => {
    const user = userEvent.setup();
    renderReady();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "设置" }));
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "继续今天的学习" }),
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "进入场景" }));
  });
});
