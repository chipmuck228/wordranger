import path from "node:path";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function defaultContextualPromotionRoot(cwd = process.cwd()): string {
  return path.resolve(cwd, "docs/contextual-content-promotions");
}

export function contextualPromotionRoot(
  env: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
): string {
  const override = env.CONTEXTUAL_CONTENT_PROMOTION_ROOT?.trim();
  return override ? path.resolve(override) : defaultContextualPromotionRoot(cwd);
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
