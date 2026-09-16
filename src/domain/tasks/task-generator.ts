import type { TaskGenerationRequest } from "./task-generation-request";
import type { TaskGenerationResult } from "./task-unavailable";

export interface TaskGenerator {
  generate(request: TaskGenerationRequest): Promise<TaskGenerationResult>;
}
