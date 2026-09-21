import path from "node:path";
import { RELEASE_ID_PATTERN } from "@/contextual-learning/candidate-v0/release";

export function contextualReleaseRoot(): string {
  return path.resolve(process.cwd(), "docs/contextual-content-releases");
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
