export { LearningTaskType, TASK_PROTOCOL_VERSION, TASK_GENERATOR_VERSION } from "./task-type";
export type {
  TaskPrompt,
  PublicTaskOption,
  TaskResponseContract,
  PublicTaskHint,
} from "./learning-task";
export type { PublicLearningTask } from "./public-learning-task";
export type { TaskAnswerKey } from "./task-answer-key";
export type { GeneratedLearningTask } from "./generated-learning-task";
export type { TaskGenerationTrace } from "./task-generation-result";
export type {
  StudentAction,
  StudentActionBase,
  ChoiceStudentAction,
  TextStudentAction,
  SkipStudentAction,
  TimeoutStudentAction,
} from "./student-action";
export type { TaskEvaluation } from "./task-evaluation";
export {
  DEFAULT_TASK_GENERATION_POLICY,
  type TaskGenerationPolicy,
} from "./task-generation-policy";
export {
  DEFAULT_TASK_EVALUATION_POLICY,
  type TaskEvaluationPolicy,
} from "./task-evaluation-policy";
export {
  SeededRandomSource,
  DefaultRandomSource,
  type RandomSource,
} from "./random-source";
export { TASK_ARCHETYPES, archetypesForSkill } from "./task-archetype-registry";
export type { TaskArchetype, TaskContentRequirement } from "./task-archetype";
export type {
  TaskGenerationRequest,
  RecentTaskSummary,
} from "./task-generation-request";
export type { TaskGenerator } from "./task-generator";
export { DefaultTaskGenerator } from "./default-task-generator";
export type { TaskEvaluator } from "./task-evaluator";
export { TaskProtocolError } from "./task-evaluator";
export { DefaultTaskEvaluator } from "./default-task-evaluator";
export {
  TaskUnavailableCode,
  type TaskGenerationResult,
} from "./task-unavailable";
export { createLearningEvidenceFromTaskEvaluation } from "./evidence-factory";
export type { CreateEvidenceFromEvaluationInput } from "./evidence-factory";
export type { LearningTaskRepository } from "./learning-task-repository";
export { canCapabilityRenderTask } from "./can-capability-render-task";
export { normalizeStudentText, levenshteinDistance } from "./text-normalization";
