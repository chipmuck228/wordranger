import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEBUG_TOOL_LINKS } from "@/server/debug-tools/debug-tool-links";
import { isDebugToolsEnabled } from "@/server/debug-tools/is-debug-tools-enabled";

const home = readFileSync("src/app/page.tsx", "utf8");
const menu = readFileSync("src/components/home/home-settings-menu.tsx", "utf8");
const train = readFileSync("src/app/train/daily-training-play-client.tsx", "utf8");

describe("Homepage / Settings debug navigation", () => {
  it("removes Homepage Debug Lab entry copy", () => {
    expect(home).not.toContain("Open Vocabulary Debug Lab");
    expect(home).not.toContain("Open Task Protocol Debug Lab");
    expect(home).not.toContain("Open Scheduler Debug Lab");
    expect(home).not.toContain("Open Learning Core Debug Lab");
    expect(home).toContain("HomeSettingsMenu");
    expect(home).toContain("开始今天的训练");
    expect(home).toContain("/train");
    expect(home).toContain("/play/ranger-trial");
  });

  it("keeps a Settings Debug 工具 group with five paths", () => {
    expect(menu).toContain("Debug 工具");
    expect(DEBUG_TOOL_LINKS).toEqual([
      { href: "/debug/vocabulary", label: "词汇调试" },
      { href: "/debug/tasks", label: "任务协议调试" },
      { href: "/debug/scheduler", label: "调度器调试" },
      { href: "/debug/learning", label: "Learning Core 调试" },
      { href: "/debug/contextual-content-review", label: "内容审核工具" },
    ]);
  });

  it("hides Debug tools unless the explicit local gate is on", () => {
    expect(isDebugToolsEnabled({})).toBe(false);
    expect(isDebugToolsEnabled({ DEBUG_TOOLS_ENABLED: "1" })).toBe(true);
    expect(
      isDebugToolsEnabled({ DEBUG_TOOLS_ENABLED: "1", VERCEL_ENV: "production" }),
    ).toBe(false);
    expect(
      isDebugToolsEnabled({ DEBUG_TOOLS_ENABLED: "1", VERCEL_ENV: "preview" }),
    ).toBe(false);
    expect(home).toContain("isDebugToolsEnabled()");
  });

  it("does not put Debug tools in student training navigation", () => {
    expect(train).not.toContain("/debug/vocabulary");
    expect(train).not.toContain("Debug 工具");
    expect(train).not.toContain("Open Vocabulary Debug Lab");
  });
});
