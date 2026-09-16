import type { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { PublicLearningTask } from "./public-learning-task";
import type { TaskAnswerKey } from "./task-answer-key";
import type { TaskGenerationTrace } from "./task-generation-result";

export interface GeneratedLearningTask {
  publicTask: PublicLearningTask;
  answerKey: TaskAnswerKey;
  generationTrace: TaskGenerationTrace;
}

export { type PublicLearningTask } from "./public-learning-task";
export type { AnswerMode, PromptMode, VocabularySkill };
