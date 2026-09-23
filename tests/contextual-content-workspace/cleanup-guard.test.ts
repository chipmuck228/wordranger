import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSafeTestWorkspaceCleanup,
  cleanupContextualContentTestWorkspace,
  createContextualContentTestWorkspace,
  humanWorkspaceRoots,
  UnsafeTestWorkspaceCleanupError,
  type ContextualContentTestWorkspace,
} from "./index";

const workspaces: ContextualContentTestWorkspace[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();
    if (workspace) {
      cleanupContextualContentTestWorkspace(workspace);
    }
  }
});

function workspace(): ContextualContentTestWorkspace {
  const created = createContextualContentTestWorkspace("cleanup-guard");
  workspaces.push(created);
  return created;
}

describe("contextual content test workspace cleanup guards", () => {
  it("refuses repository, docs, human roots, parent, escape, and outside symlink", () => {
    const created = workspace();
    const human = humanWorkspaceRoots();
    const rejected = [
      human.cwd,
      human.docs,
      human.review,
      human.promotion,
      human.release,
      path.dirname(created.root),
      path.join(created.root, "..", "escaped"),
    ];
    for (const target of rejected) {
      expect(() => assertSafeTestWorkspaceCleanup(target, created)).toThrow(
        UnsafeTestWorkspaceCleanupError,
      );
    }
    const outside = path.join(tmpdir(), `wordranger-outside-${created.token}`);
    mkdirSync(outside, { recursive: true });
    const link = path.join(created.root, "outside-link");
    try {
      symlinkSync(outside, link);
      expect(() => assertSafeTestWorkspaceCleanup(link, created)).toThrow(
        UnsafeTestWorkspaceCleanupError,
      );
    } finally {
      cleanupContextualContentTestWorkspace({
        root: created.root,
        token: created.token,
      });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("repeats cleanup without widening the delete", () => {
    const created = workspace();
    cleanupContextualContentTestWorkspace(created);
    expect(() => cleanupContextualContentTestWorkspace(created)).not.toThrow();
    expect(() =>
      assertSafeTestWorkspaceCleanup(humanWorkspaceRoots().review, created),
    ).toThrow(UnsafeTestWorkspaceCleanupError);
  });

  it("failure cleanup only removes the throwing test temp root", () => {
    const left = workspace();
    const right = workspace();
    writeFileSync(path.join(left.reviewRoot, "keep.txt"), "keep\n");
    writeFileSync(path.join(right.reviewRoot, "drop.txt"), "drop\n");
    try {
      throw new Error("mid-test");
    } catch {
      cleanupContextualContentTestWorkspace(right);
    }
    expect(path.join(left.reviewRoot, "keep.txt")).toBe(
      path.join(left.reviewRoot, "keep.txt"),
    );
    expect(existsSync(path.join(left.reviewRoot, "keep.txt"))).toBe(true);
    expect(existsSync(right.root)).toBe(false);
  });

  it("parallel workspaces do not delete each other", () => {
    const first = workspace();
    const second = workspace();
    writeFileSync(path.join(first.reviewRoot, "a.txt"), "a\n");
    writeFileSync(path.join(second.reviewRoot, "b.txt"), "b\n");
    cleanupContextualContentTestWorkspace(first);
    expect(existsSync(first.root)).toBe(false);
    expect(readFileSync(path.join(second.reviewRoot, "b.txt"), "utf8")).toBe("b\n");
  });
});
