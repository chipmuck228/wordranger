import { describe, expect, it } from "vitest";
import {
  changeDirection,
  createInitialSnakeState,
  SNAKE_BOARD_HEIGHT,
  SNAKE_BOARD_WIDTH,
  tickSnake,
  wrapPosition,
} from "@/components/game/snake/snake-engine";
import { layoutSnakeOptions } from "@/components/game/snake/snake-layout";

describe("Snake engine", () => {
  it("S1: initial snake state is valid", () => {
    const state = createInitialSnakeState();
    expect(state.body.length).toBeGreaterThan(0);
    expect(state.direction).toBe("RIGHT");
    expect(state.pendingDirection).toBeNull();
    for (const segment of state.body) {
      expect(segment.x).toBeGreaterThanOrEqual(0);
      expect(segment.x).toBeLessThan(SNAKE_BOARD_WIDTH);
      expect(segment.y).toBeGreaterThanOrEqual(0);
      expect(segment.y).toBeLessThan(SNAKE_BOARD_HEIGHT);
    }
  });

  it("S2: tick moves exactly one cell", () => {
    const state = createInitialSnakeState();
    const head = state.body[0];
    const next = tickSnake(state, []);
    expect(next.event.kind).toBe("MOVED");
    expect(next.state.body[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(next.state.body).toHaveLength(state.body.length);
  });

  it("S3: direction change works", () => {
    const turned = changeDirection(createInitialSnakeState(), "DOWN");
    const next = tickSnake(turned, []);
    expect(next.state.direction).toBe("DOWN");
    expect(next.state.body[0].y).toBe(createInitialSnakeState().body[0].y + 1);
  });

  it("S4: opposite direction is rejected", () => {
    const state = createInitialSnakeState();
    const rejected = changeDirection(state, "LEFT");
    expect(rejected.pendingDirection).toBeNull();
    expect(rejected.direction).toBe("RIGHT");
    const next = tickSnake(rejected, []);
    expect(next.state.body[0].x).toBe(state.body[0].x + 1);
  });

  it("S5: wrap-around works", () => {
    expect(wrapPosition({ x: 12, y: 8 })).toEqual({ x: 0, y: 8 });
    expect(wrapPosition({ x: -1, y: 0 })).toEqual({
      x: SNAKE_BOARD_WIDTH - 1,
      y: 0,
    });
    let state = createInitialSnakeState();
    for (let i = 0; i < SNAKE_BOARD_WIDTH; i += 1) {
      state = tickSnake(state, []).state;
    }
    expect(state.body[0].x).toBe(createInitialSnakeState().body[0].x);
    expect(state.body[0].y).toBe(createInitialSnakeState().body[0].y);
  });

  it("S6: option collision is detected", () => {
    const state = createInitialSnakeState();
    const target = { x: state.body[0].x + 1, y: state.body[0].y };
    const next = tickSnake(state, [{ id: "opt-a", position: target }]);
    expect(next.event).toEqual({ kind: "OPTION_COLLISION", optionId: "opt-a" });
  });

  it("S7: movement without collision emits no semantic event", () => {
    let state = createInitialSnakeState();
    for (let i = 0; i < 10; i += 1) {
      const next = tickSnake(state, []);
      expect(next.event.kind).toBe("MOVED");
      state = changeDirection(next.state, i % 2 === 0 ? "DOWN" : "RIGHT");
    }
  });

  it("S8: same task creates the same option layout", () => {
    const options = [
      { id: "opt-a", text: "安静" },
      { id: "opt-b", text: "完全" },
      { id: "opt-c", text: "迅速" },
    ];
    expect(layoutSnakeOptions("task-1", options)).toEqual(
      layoutSnakeOptions("task-1", options),
    );
    expect(layoutSnakeOptions("task-1", options)).not.toEqual(
      layoutSnakeOptions("task-2", options),
    );
    const placed = layoutSnakeOptions("task-1", options);
    const cells = placed.map((item) => `${item.position.x},${item.position.y}`);
    expect(new Set(cells).size).toBe(placed.length);
    const body = createInitialSnakeState().body.map(
      (item) => `${item.x},${item.y}`,
    );
    for (const cell of cells) {
      expect(body.includes(cell)).toBe(false);
    }
  });
});
