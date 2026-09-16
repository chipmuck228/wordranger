import type { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type {
  PublicTaskHint,
  TaskPrompt,
  TaskResponseContract,
} from "./learning-task";
import type { LearningTaskType } from "./task-type";

export interface PublicLearningTask {
  id: string;
  protocolVersion: string;
  generatorVersion: string;
  learningNeedId: string;
  lexemeId: string;
  targetSkill: VocabularySkill;
  taskType: LearningTaskType;
  promptMode: PromptMode;
  answerMode: AnswerMode;
  difficulty: number;
  prompt: TaskPrompt;
  responseContract: TaskResponseContract;
  hints: PublicTaskHint[];
  createdAt: string;
}
