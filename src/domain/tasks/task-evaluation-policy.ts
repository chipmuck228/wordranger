export interface TaskEvaluationPolicy {
  version: string;
  spelling: {
    minorEditDistance: number;
  };
  textNormalization: {
    trimWhitespace: boolean;
    caseInsensitive: boolean;
  };
}

export const DEFAULT_TASK_EVALUATION_POLICY: TaskEvaluationPolicy = {
  version: "v1",
  spelling: {
    minorEditDistance: 1,
  },
  textNormalization: {
    trimWhitespace: true,
    caseInsensitive: true,
  },
};
