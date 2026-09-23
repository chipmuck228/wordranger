"use client";

import { RangerTrialTask } from "@/components/game/ranger-trial/RangerTrialTask";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { StudentActionIntent } from "@/server/game-session/learning-game-session.types";

export function DirectPracticeRenderer(props: {
  task: PublicLearningTask;
  disabled: boolean;
  onAction(intent: StudentActionIntent): void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <RangerTrialTask
        task={props.task}
        disabled={props.disabled}
        onAction={props.onAction}
      />
    </div>
  );
}
