import { existsSync, lstatSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { humanWorkspaceRoots } from "./human-workspace";
import {
  CONTEXTUAL_CONTENT_TEST_WORKSPACE_KIND,
  WORKSPACE_MARKER_NAME,
} from "./invariants";
import type { ContextualContentTestWorkspace } from "./create-workspace";

export class UnsafeTestWorkspaceCleanupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTestWorkspaceCleanupError";
  }
}

function resolveExisting(filePath: string): string {
  const resolved = path.resolve(filePath);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function isInsideOrEqual(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function forbiddenCleanupRoots(cwd = process.cwd()): string[] {
  const human = humanWorkspaceRoots(cwd);
  return [
    human.cwd,
    path.dirname(human.cwd),
    human.docs,
    human.review,
    human.promotion,
    human.release,
    path.resolve(tmpdir()),
  ];
}

export function readWorkspaceMarker(root: string): { kind: string; token: string } | null {
  const markerPath = path.join(root, WORKSPACE_MARKER_NAME);
  if (!existsSync(markerPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(markerPath, "utf8")) as {
      kind?: string;
      token?: string;
    };
    if (parsed.kind !== CONTEXTUAL_CONTENT_TEST_WORKSPACE_KIND || !parsed.token) {
      return null;
    }
    return { kind: parsed.kind, token: parsed.token };
  } catch {
    return null;
  }
}

export function assertSafeTestWorkspaceCleanup(
  target: string,
  workspace: Pick<ContextualContentTestWorkspace, "root" | "token">,
  cwd = process.cwd(),
): string {
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== path.resolve(workspace.root)) {
    throw new UnsafeTestWorkspaceCleanupError(
      "Cleanup may delete only the temp root this helper created.",
    );
  }
  if (existsSync(resolvedTarget) && lstatSync(resolvedTarget).isSymbolicLink()) {
    throw new UnsafeTestWorkspaceCleanupError("Cleanup refuses a symlink workspace root.");
  }
  const realTarget = resolveExisting(resolvedTarget);
  const realWorkspace = resolveExisting(workspace.root);
  if (realTarget !== realWorkspace) {
    throw new UnsafeTestWorkspaceCleanupError(
      "Cleanup target escaped the helper-created temp root.",
    );
  }
  const tempRoot = resolveExisting(tmpdir());
  if (!isInsideOrEqual(realTarget, tempRoot) || realTarget === tempRoot) {
    throw new UnsafeTestWorkspaceCleanupError(
      "Cleanup target is not a child of the process temp directory.",
    );
  }
  for (const forbidden of forbiddenCleanupRoots(cwd)) {
    const realForbidden = resolveExisting(forbidden);
    if (realTarget === realForbidden || isInsideOrEqual(realForbidden, realTarget)) {
      throw new UnsafeTestWorkspaceCleanupError(
        `Cleanup refuses human or repository path ${forbidden}.`,
      );
    }
  }
  if (existsSync(realTarget)) {
    const marker = readWorkspaceMarker(realTarget);
    if (!marker || marker.token !== workspace.token) {
      throw new UnsafeTestWorkspaceCleanupError(
        "Cleanup refuses a directory without this helper's marker token.",
      );
    }
  }
  return realTarget;
}

export function cleanupContextualContentTestWorkspace(
  workspace: Pick<ContextualContentTestWorkspace, "root" | "token">,
  cwd = process.cwd(),
): void {
  if (!existsSync(path.resolve(workspace.root))) {
    return;
  }
  const target = assertSafeTestWorkspaceCleanup(workspace.root, workspace, cwd);
  rmSync(target, { recursive: true, force: true });
}
