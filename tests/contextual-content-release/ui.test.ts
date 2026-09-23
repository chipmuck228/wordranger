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

  it("shows experimental Context Lab publish controls without /train", () => {
    expect(workspace).toContain("当前 targets");
    expect(workspace).toContain("当前可发布 Candidate");
    expect(workspace).toContain("release-eligible-pack");
    expect(workspace).toContain("!workspace.eligibility.canCreateDraft");
    expect(workspace).not.toContain("绕过审核");
    expect(workspace).not.toContain("bypass");
    expect(workspace).toContain("创建迁移 Draft");
    expect(workspace).toContain("运行 Preflight");
    expect(workspace).toContain("Publish");
    expect(workspace).toContain("确认 Publish");
    expect(workspace).toContain("设为活动版本/回滚到此版本");
    expect(workspace).toContain("Experimental Context Lab");
    expect(workspace).toContain("不会发布到 /train");
    expect(workspace).not.toContain("Promote to Standard");
    expect(workspace).not.toContain('href="/train"');
  });

  it("accepts only CAS identity from the browser", () => {
    expect(actions).not.toContain("userId");
    expect(actions).not.toContain("publishedBy");
    expect(actions).not.toContain("activatedBy");
    expect(actions).toContain("releaseId");
    expect(actions).toContain("revision");
    expect(actions).toContain("publishContextualContentRelease");
    expect(actions).toContain("rollbackContextualContentActiveRelease");
  });
});
