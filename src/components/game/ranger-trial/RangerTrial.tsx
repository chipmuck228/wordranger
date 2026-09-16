import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { RangerTrialTask } from "./RangerTrialTask";
import { TaskProgress } from "./TaskProgress";
import type { StudentActionIntent } from "./types";

export function RangerTrial({
  task,
  current,
  total,
  disabled,
  onAction,
}: {
  task: PublicLearningTask;
  current: number;
  total: number;
  disabled?: boolean;
  onAction(intent: StudentActionIntent): void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <TaskProgress current={current} total={total} />
      <RangerTrialTask task={task} disabled={disabled} onAction={onAction} />
    </div>
  );
}
