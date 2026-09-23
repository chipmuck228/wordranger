import path from "node:path";
import { RELEASE_ID_PATTERN } from "@/contextual-learning/candidate-v0/release";

export function defaultContextualReleaseRoot(cwd = process.cwd()): string {
  return path.resolve(cwd, "docs/contextual-content-releases");
}

export function contextualReleaseRoot(
  env: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
): string {
  const override = env.CONTEXTUAL_CONTENT_RELEASE_ROOT?.trim();
  return override ? path.resolve(override) : defaultContextualReleaseRoot(cwd);
}

export function safeReleaseRecordPath(releaseId: string): string | null {
  if (!RELEASE_ID_PATTERN.test(releaseId)) {
    return null;
  }
  const root = contextualReleaseRoot();
  const filePath = path.resolve(root, `${releaseId}.json`);
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  if (path.basename(filePath) !== `${releaseId}.json`) {
    return null;
  }
  return filePath;
}

export function safeActivePointerPath(sceneId: string): string | null {
  if (!RELEASE_ID_PATTERN.test(sceneId)) {
    return null;
  }
  const root = contextualReleaseRoot();
  const filePath = path.resolve(root, `pointer-${sceneId}.json`);
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  if (path.basename(filePath) !== `pointer-${sceneId}.json`) {
    return null;
  }
  return filePath;
}
