export interface TaskGenerationPolicy {
  version: string;
  choice: {
    optionCount: number;
    candidatePoolLimit: number;
  };
  difficulty: {
    min: number;
    max: number;
    defaultValue: number;
  };
  recentAvoidance: {
    taskHistoryWindow: number;
  };
}

export const DEFAULT_TASK_GENERATION_POLICY: TaskGenerationPolicy = {
  version: "v1",
  choice: {
    optionCount: 4,
    candidatePoolLimit: 48,
  },
  difficulty: {
    min: 0,
    max: 1,
    defaultValue: 0.5,
  },
  recentAvoidance: {
    taskHistoryWindow: 8,
  },
};
