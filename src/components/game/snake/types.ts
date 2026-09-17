export type StudentActionIntent = { kind: "CHOICE"; optionId: string };

export type SnakeDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

export interface SnakePosition {
  x: number;
  y: number;
}

export interface SnakePresentationOption {
  id: string;
  text: string;
}

export interface SnakePresentation {
  instruction: string;
  promptText: string;
  options: SnakePresentationOption[];
}

export interface SnakeOptionObject {
  id: string;
  text: string;
  position: SnakePosition;
}

export interface SnakeState {
  body: SnakePosition[];
  direction: SnakeDirection;
  pendingDirection: SnakeDirection | null;
}

export type SnakeTickEvent =
  | { kind: "MOVED" }
  | { kind: "OPTION_COLLISION"; optionId: string };

export interface SnakeTickResult {
  state: SnakeState;
  event: SnakeTickEvent;
}

export interface SnakeGameHandle {
  tick(): SnakeTickResult | null;
  getState(): SnakeState;
}
