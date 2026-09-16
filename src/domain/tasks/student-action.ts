export interface StudentActionBase {
  taskId: string;
  occurredAt: string;
  responseTimeMs: number | null;
  hintCount: number;
}

export interface ChoiceStudentAction extends StudentActionBase {
  kind: "CHOICE";
  optionId: string;
}

export interface TextStudentAction extends StudentActionBase {
  kind: "TEXT_INPUT";
  value: string;
}

export interface SkipStudentAction extends StudentActionBase {
  kind: "SKIP";
}

export interface TimeoutStudentAction extends StudentActionBase {
  kind: "TIMEOUT";
}

export type StudentAction =
  | ChoiceStudentAction
  | TextStudentAction
  | SkipStudentAction
  | TimeoutStudentAction;
