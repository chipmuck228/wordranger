import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { Button } from "@/components/ui/button";
import { SnakeBoard } from "./SnakeBoard";
import { SnakeHud } from "./SnakeHud";
import { SnakePrompt } from "./SnakePrompt";
import {
  changeDirection,
  createInitialSnakeState,
  SNAKE_LOGICAL_TICK_MS,
  tickSnake,
} from "./snake-engine";
import { layoutSnakeOptions } from "./snake-layout";
import { snakePresentationFromTask } from "./snake-presentation";
import type {
  SnakeDirection,
  SnakeGameHandle,
  SnakeState,
  SnakeTickResult,
  StudentActionIntent,
} from "./types";

const KEY_TO_DIRECTION: Record<string, SnakeDirection> = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  w: "UP",
  a: "LEFT",
  s: "DOWN",
  d: "RIGHT",
  W: "UP",
  A: "LEFT",
  S: "DOWN",
  D: "RIGHT",
};

export const SnakeGame = forwardRef<
  SnakeGameHandle,
  {
    task: PublicLearningTask;
    current: number;
    total: number;
    disabled?: boolean;
    result?: "correct" | "incorrect";
    autoTick?: boolean;
    logicalTickMs?: number;
    onAction(intent: StudentActionIntent): void;
  }
>(function SnakeGame(
  {
    task,
    current,
    total,
    disabled,
    result,
    autoTick = true,
    logicalTickMs = SNAKE_LOGICAL_TICK_MS,
    onAction,
  },
  ref,
) {
  const presentation = useMemo(() => snakePresentationFromTask(task), [task]);
  const options = useMemo(
    () =>
      presentation ? layoutSnakeOptions(task.id, presentation.options) : [],
    [presentation, task.id],
  );
  const [board, setBoard] = useState(() => ({
    taskId: task.id,
    state: createInitialSnakeState(),
    locked: false,
  }));
  if (board.taskId !== task.id) {
    setBoard({
      taskId: task.id,
      state: createInitialSnakeState(),
      locked: false,
    });
  }

  const stateRef = useRef(board.state);
  const lockedRef = useRef(board.locked);
  const optionsRef = useRef(options);
  const onActionRef = useRef(onAction);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    stateRef.current = board.state;
    lockedRef.current = board.locked;
    optionsRef.current = options;
    onActionRef.current = onAction;
    disabledRef.current = disabled;
  }, [board.locked, board.state, disabled, onAction, options]);

  const applyTick = useCallback((): SnakeTickResult | null => {
    if (disabledRef.current || lockedRef.current) {
      return null;
    }
    const resultTick = tickSnake(stateRef.current, optionsRef.current);
    lockedRef.current = resultTick.event.kind === "OPTION_COLLISION";
    stateRef.current = resultTick.state;
    setBoard((currentBoard) => ({
      ...currentBoard,
      state: resultTick.state,
      locked: resultTick.event.kind === "OPTION_COLLISION",
    }));
    if (resultTick.event.kind === "OPTION_COLLISION") {
      onActionRef.current({
        kind: "CHOICE",
        optionId: resultTick.event.optionId,
      });
    }
    return resultTick;
  }, []);

  const applyDirection = useCallback((direction: SnakeDirection): void => {
    if (disabledRef.current || lockedRef.current) {
      return;
    }
    const next = changeDirection(stateRef.current, direction);
    stateRef.current = next;
    setBoard((currentBoard) => ({
      ...currentBoard,
      state: next,
    }));
  }, []);

  useImperativeHandle(ref, () => ({
    tick: applyTick,
    getState: () => stateRef.current,
  }));

  useEffect(() => {
    if (disabled || !autoTick) {
      return;
    }
    const timer = window.setInterval(() => {
      applyTick();
    }, logicalTickMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [applyTick, autoTick, disabled, logicalTickMs, task.id]);

  useEffect(() => {
    if (disabled) {
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) {
        return;
      }
      event.preventDefault();
      applyDirection(direction);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [applyDirection, disabled, task.id]);

  if (!presentation) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5">
      <SnakeHud current={current} total={total} />
      <SnakePrompt
        instruction={presentation.instruction}
        promptText={presentation.promptText}
      />
      <SnakeBoard state={board.state} options={options} result={result} />
      <div
        className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2"
        role="group"
        aria-label="方向控制"
      >
        <span />
        <DirectionButton
          label="向上"
          disabled={disabled || board.locked}
          onPress={() => applyDirection("UP")}
        />
        <span />
        <DirectionButton
          label="向左"
          disabled={disabled || board.locked}
          onPress={() => applyDirection("LEFT")}
        />
        <DirectionButton
          label="向下"
          disabled={disabled || board.locked}
          onPress={() => applyDirection("DOWN")}
        />
        <DirectionButton
          label="向右"
          disabled={disabled || board.locked}
          onPress={() => applyDirection("RIGHT")}
        />
      </div>
      <p className="text-muted-foreground text-center text-xs">
        方向键 / WASD / 屏幕按钮
      </p>
    </div>
  );
});

function DirectionButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress(): void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 text-base"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
    >
      {label === "向上"
        ? "↑"
        : label === "向下"
          ? "↓"
          : label === "向左"
            ? "←"
            : "→"}
    </Button>
  );
}

export type { SnakeState };
