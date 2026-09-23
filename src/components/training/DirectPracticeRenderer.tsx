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
    <div className="flex flex-col gap-6 md:gap-8 md:[&_.text-center]:text-left md:[&_[role='group'][aria-label='选项']]:grid md:[&_[role='group'][aria-label='选项']]:grid-cols-2 md:[&_[role='group'][aria-label='选项']]:gap-4 md:[&_form]:max-w-lg md:[&_form_button[type=submit]]:w-auto md:[&_form_button[type=submit]]:min-w-40 md:[&_form_button[type=submit]]:self-start">
      <RangerTrialTask
        task={props.task}
        disabled={props.disabled}
        onAction={props.onAction}
      />
    </div>
  );
}
