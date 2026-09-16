import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";

export type StudentActionIntent =
  | { kind: "CHOICE"; optionId: string }
  | { kind: "TEXT_INPUT"; value: string };

export interface LearningTaskRendererProps {
  task: PublicLearningTask;
  disabled?: boolean;
  onAction(intent: StudentActionIntent): void;
}
