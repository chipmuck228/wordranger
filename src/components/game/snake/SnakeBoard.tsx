import {
  SNAKE_BOARD_HEIGHT,
  SNAKE_BOARD_WIDTH,
  samePosition,
} from "./snake-engine";
import type { SnakeOptionObject, SnakeState } from "./types";

export function SnakeBoard({
  state,
  options,
  result,
}: {
  state: SnakeState;
  options: SnakeOptionObject[];
  result?: "correct" | "incorrect";
}) {
  const head = state.body[0];
  const resultClass =
    result === "correct"
      ? "snake-card-pop"
      : result === "incorrect"
        ? "snake-card-shake"
        : "";
  return (
    <div
      className={`snake-board relative overflow-hidden rounded-2xl border bg-card ${resultClass}`}
      role="application"
      aria-label="贪食蛇棋盘"
      data-head-x={head.x}
      data-head-y={head.y}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${SNAKE_BOARD_WIDTH}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${SNAKE_BOARD_HEIGHT}, minmax(0, 1fr))`,
        aspectRatio: `${SNAKE_BOARD_WIDTH} / ${SNAKE_BOARD_HEIGHT}`,
      }}
    >
      {Array.from({ length: SNAKE_BOARD_WIDTH * SNAKE_BOARD_HEIGHT }, (_, index) => {
        const x = index % SNAKE_BOARD_WIDTH;
        const y = Math.floor(index / SNAKE_BOARD_WIDTH);
        const bodyIndex = state.body.findIndex((segment) =>
          samePosition(segment, { x, y }),
        );
        const option = options.find((item) => samePosition(item.position, { x, y }));
        const isHead = bodyIndex === 0;
        return (
          <div
            key={`${x}-${y}`}
            className={`snake-cell relative border-[0.5px] border-border/40 ${
              isHead
                ? "bg-amber-400"
                : bodyIndex > 0
                  ? "bg-amber-200"
                  : "bg-muted/20"
            }`}
            data-x={x}
            data-y={y}
            data-snake-head={isHead ? "true" : undefined}
          >
            {option ? (
              <span
                className="absolute inset-0 z-10 flex items-center justify-center px-0.5 text-center text-[10px] leading-tight font-medium break-all sm:text-xs"
                data-option-id={option.id}
                data-cell-x={option.position.x}
                data-cell-y={option.position.y}
              >
                {option.text}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
