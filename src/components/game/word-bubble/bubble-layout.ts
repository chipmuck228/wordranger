import type { BubbleLayoutPosition } from "./types";

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unit(hash: number, salt: number): number {
  return ((hash ^ Math.imul(salt, 0x9e3779b9)) >>> 0) / 4294967295;
}

export function bubbleLayoutSeed(taskId: string): string {
  return `bubble-layout:${taskId}`;
}

/**
 * Deterministic initial positions from task.id + option.id.
 * Independent of correctness. Refresh may rebuild motion, not these slots.
 */
export function layoutBubbleOptions(
  taskId: string,
  optionIds: string[],
): BubbleLayoutPosition[] {
  const seed = bubbleLayoutSeed(taskId);
  const count = Math.max(optionIds.length, 1);
  const cols = count <= 3 ? count : Math.min(3, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const order = [...optionIds].sort((left, right) => {
    const delta = fnv1a(`${seed}:${left}`) - fnv1a(`${seed}:${right}`);
    return delta !== 0 ? delta : left.localeCompare(right);
  });
  return order.map((optionId, index) => {
    const hash = fnv1a(`${seed}:${optionId}`);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    const jitterX = (unit(hash, 1) - 0.5) * Math.min(18, cellW * 0.35);
    const jitterY = (unit(hash, 2) - 0.5) * Math.min(16, cellH * 0.3);
    return {
      optionId,
      x: Math.min(86, Math.max(14, cellW * col + cellW * 0.5 + jitterX)),
      y: Math.min(80, Math.max(18, cellH * row + cellH * 0.5 + jitterY)),
      delayMs: Math.round(unit(hash, 3) * 1600),
      driftX: `${((unit(hash, 4) - 0.5) * 14).toFixed(1)}px`,
      driftY: `${((unit(hash, 5) - 0.5) * 16).toFixed(1)}px`,
      durationMs: 4200 + Math.round(unit(hash, 6) * 1800),
    };
  });
}
