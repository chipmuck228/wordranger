import type { PublicTaskHint } from "@/domain/tasks/learning-task";
import type { StepSupportPolicy, SupportBlock } from "../domain/types";

export function compileSupportHints(
  policy: StepSupportPolicy,
  blocks: ReadonlyMap<string, SupportBlock> | undefined,
): PublicTaskHint[] {
  if (!blocks) {
    return [];
  }
  const hints: PublicTaskHint[] = [];
  for (const level of policy.ladder) {
    if (level.level === 0) {
      continue;
    }
    for (const blockId of level.supportBlockIds) {
      const block = blocks.get(blockId);
      if (!block) {
        continue;
      }
      const text = supportBlockText(block);
      if (text) {
        hints.push({ id: block.id, text });
      }
    }
  }
  return hints;
}

function supportBlockText(block: SupportBlock): string | null {
  if (block.content.kind === "TEXT") {
    return block.content.text;
  }
  if (block.content.kind === "PARTIAL_LEXICAL_CUE") {
    return block.content.pattern;
  }
  if (block.content.kind === "CONTRAST") {
    return block.content.focus;
  }
  return null;
}
