import { TaskPromptView } from "@/components/game/shared/TaskPromptView";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";

export function BubblePrompt({ task }: { task: PublicLearningTask }) {
  return <TaskPromptView prompt={task.prompt} taskType={task.taskType} />;
}
