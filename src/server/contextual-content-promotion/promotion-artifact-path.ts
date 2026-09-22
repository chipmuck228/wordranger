import path from "node:path";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function contextualPromotionRoot(): string {
  return path.resolve(process.cwd(), "docs/contextual-content-promotions");
}

export function safePromotionRecordPath(input: { sceneId: string; packId: string }): string | null {
  if (!ID_PATTERN.test(input.sceneId) || !ID_PATTERN.test(input.packId)) {
    return null;
  }
  const root = contextualPromotionRoot();
  const filePath = path.resolve(root, `${input.sceneId}__${input.packId}.json`);
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  if (path.basename(filePath) !== `${input.sceneId}__${input.packId}.json`) {
    return null;
  }
  return filePath;
}
