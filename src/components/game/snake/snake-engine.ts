import type {
  SnakeDirection,
  SnakePosition,
  SnakeState,
  SnakeTickResult,
} from "./types";

export const SNAKE_BOARD_WIDTH = 12;
export const SNAKE_BOARD_HEIGHT = 16;
export const SNAKE_LOGICAL_TICK_MS = 250;

const OPPOSITE: Record<SnakeDirection, SnakeDirection> = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT",
};

const STEP: Record<SnakeDirection, SnakePosition> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

export function wrapPosition(position: SnakePosition): SnakePosition {
  return {
    x:
      ((position.x % SNAKE_BOARD_WIDTH) + SNAKE_BOARD_WIDTH) % SNAKE_BOARD_WIDTH,
    y:
      ((position.y % SNAKE_BOARD_HEIGHT) + SNAKE_BOARD_HEIGHT) %
      SNAKE_BOARD_HEIGHT,
  };
}

export function samePosition(left: SnakePosition, right: SnakePosition): boolean {
  return left.x === right.x && left.y === right.y;
}

export function createInitialSnakeState(): SnakeState {
  return {
    body: [
      { x: 2, y: 8 },
      { x: 1, y: 8 },
      { x: 0, y: 8 },
    ],
    direction: "RIGHT",
    pendingDirection: null,
  };
}

export function changeDirection(
  state: SnakeState,
  next: SnakeDirection,
): SnakeState {
  if (OPPOSITE[state.direction] === next) {
    return state;
  }
  return {
    ...state,
    pendingDirection: next,
  };
}

function nextHead(state: SnakeState): { head: SnakePosition; direction: SnakeDirection } {
  const direction = state.pendingDirection ?? state.direction;
  const current = state.body[0];
  const delta = STEP[direction];
  return {
    direction,
    head: wrapPosition({
      x: current.x + delta.x,
      y: current.y + delta.y,
    }),
  };
}

/**
 * One logical tick. Movement is renderer-local.
 * Only OPTION_COLLISION is a semantic event for the adapter.
 */
export function tickSnake(
  state: SnakeState,
  options: Array<{ id: string; position: SnakePosition }>,
): SnakeTickResult {
  const { head, direction } = nextHead(state);
  const occupied = state.body.slice(0, -1);
  if (occupied.some((segment) => samePosition(segment, head))) {
    return {
      state: {
        ...state,
        direction,
        pendingDirection: null,
      },
      event: { kind: "MOVED" },
    };
  }
  const nextState: SnakeState = {
    body: [head, ...state.body.slice(0, -1)],
    direction,
    pendingDirection: null,
  };
  const hit = options.find((option) => samePosition(option.position, head));
  return {
    state: nextState,
    event: hit
      ? { kind: "OPTION_COLLISION", optionId: hit.id }
      : { kind: "MOVED" },
  };
}

export function detectOptionCollision(
  position: SnakePosition,
  options: Array<{ id: string; position: SnakePosition }>,
): string | null {
  return options.find((option) => samePosition(option.position, position))?.id ?? null;
}
