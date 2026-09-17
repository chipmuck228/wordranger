import {
  createInitialSnakeState,
  SNAKE_BOARD_HEIGHT,
  SNAKE_BOARD_WIDTH,
  samePosition,
} from "./snake-engine";
import type { SnakeOptionObject, SnakePosition } from "./types";

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function candidateCells(blocked: SnakePosition[]): SnakePosition[] {
  const cells: SnakePosition[] = [];
  for (let y = 1; y < SNAKE_BOARD_HEIGHT - 1; y += 3) {
    for (let x = 4; x < SNAKE_BOARD_WIDTH - 1; x += 3) {
      const cell = { x, y };
      if (!blocked.some((item) => samePosition(item, cell))) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

/**
 * Deterministic option placement from task.id + option.id.
 * Independent of correctness. Refresh rebuilds the same slots.
 */
export function layoutSnakeOptions(
  taskId: string,
  options: Array<{ id: string; text: string }>,
): SnakeOptionObject[] {
  const blocked = createInitialSnakeState().body;
  const cells = candidateCells(blocked);
  if (cells.length === 0) {
    return [];
  }
  const ordered = [...options].sort((left, right) => {
    const delta =
      fnv1a(`snake-layout:${taskId}:${left.id}`) -
      fnv1a(`snake-layout:${taskId}:${right.id}`);
    return delta !== 0 ? delta : left.id.localeCompare(right.id);
  });
  const used = new Set<string>();
  return ordered.map((option) => {
    const start = fnv1a(`snake-layout:${taskId}:${option.id}`) % cells.length;
    let placed = cells[start];
    for (let offset = 0; offset < cells.length; offset += 1) {
      const candidate = cells[(start + offset) % cells.length];
      const key = `${candidate.x},${candidate.y}`;
      if (!used.has(key)) {
        used.add(key);
        placed = candidate;
        break;
      }
    }
    return {
      id: option.id,
      text: option.text,
      position: placed,
    };
  });
}
