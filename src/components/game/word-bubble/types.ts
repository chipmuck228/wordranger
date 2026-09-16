export type StudentActionIntent = { kind: "CHOICE"; optionId: string };

export interface BubbleLayoutPosition {
  optionId: string;
  x: number;
  y: number;
  delayMs: number;
  driftX: string;
  driftY: string;
  durationMs: number;
}
