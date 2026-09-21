import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEBUG_TOOL_LINKS } from "@/server/debug-tools/debug-tool-links";
import {
  isContextualContentReleaseEnabled,
  isContextualContentReleaseWriteEnabled,
} from "@/server/contextual-content-release/gates";

const page = readFileSync("src/app/debug/contextual-content-release/page.tsx", "utf8");
const workspace = readFileSync("src/app/debug/contextual-content-release/release-workspace.tsx", "utf8");
const actions = readFileSync("src/app/debug/contextual-content-release/actions.ts", "utf8");

describe("release debug UI", () => {
  it("is listed as a Settings debug tool and 404s when the flag is off", () => {
    expect(DEBUG_TOOL_LINKS.some((item) => item.href === "/debug/contextual-content-release")).toBe(true);
    expect(page).toContain("isContextualContentReleaseEnabled");
    expect(page).toContain("notFound()");
    expect(isContextualContentReleaseEnabled({})).toBe(false);
    expect(
      isContextualContentReleaseWriteEnabled({ CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1" }),
    ).toBe(false);
  });

  it("shows six targets and no Publish/Activate/Rollback controls", () => {
    expect(workspace).toContain("六个 targets");
    expect(workspace).toContain("创建迁移 Draft");
    expect(workspace).toContain("运行 Preflight");
    expect(workspace).toContain("刷新");
    expect(workspace).toContain("放弃本地 Draft");
    expect(workspace).toContain("本阶段只验证发布快照，不会切换 Context Lab。");
    expect(workspace).not.toMatch(/>\s*Publish\s*</);
    expect(workspace).not.toMatch(/>\s*Activate\s*</);
    expect(workspace).not.toMatch(/>\s*Rollback\s*</);
    expect(workspace).not.toContain("Promote to Standard");
    expect(workspace).not.toContain('href="/train"');
  });

  it("accepts only releaseId and revision from the browser", () => {
    expect(actions).not.toContain("userId");
    expect(actions).not.toContain("fingerprint");
    expect(actions).not.toContain("pack JSON");
    expect(actions).not.toContain("desired status");
    expect(actions).toContain("releaseId");
    expect(actions).toContain("revision");
    expect(workspace).toContain("draft!.releaseId");
    expect(workspace).toContain("draft!.revision");
  });
});
