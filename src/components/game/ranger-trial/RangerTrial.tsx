import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { RangerTrialTask } from "./RangerTrialTask";
import { TaskProgress } from "./TaskProgress";
import type { StudentActionIntent } from "./types";

export function RangerTrial({
  task,
  current,
  total,
  disabled,
  showProgress = true,
  onAction,
}: {
  task: PublicLearningTask;
  current: number;
  total: number;
  disabled?: boolean;
  showProgress?: boolean;
  onAction(intent: StudentActionIntent): void;
}) {
  return (
    <div className="flex flex-col gap-8">
      {showProgress ? <TaskProgress current={current} total={total} /> : null}
      <RangerTrialTask task={task} disabled={disabled} onAction={onAction} />
    </div>
  );
}
