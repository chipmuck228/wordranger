import { LearningTaskType } from "@/domain/tasks/task-type";
import type { TaskPrompt } from "@/domain/tasks/learning-task";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";

const RELATION_COPY: Record<LexemeRelationType, (word: string) => string> = {
  [LexemeRelationType.SYNONYM]: (word) => `选择与 ${word} 意思相近的单词`,
  [LexemeRelationType.ANTONYM]: (word) => `选择与 ${word} 构成反义关系的单词`,
  [LexemeRelationType.CONFUSABLE]: (word) => `选择容易和 ${word} 混淆的单词`,
  [LexemeRelationType.WORD_FAMILY]: (word) => `选择与 ${word} 属于同一词族的单词`,
  [LexemeRelationType.VARIANT]: (word) => `选择 ${word} 的词形变体`,
  [LexemeRelationType.ABBREVIATION]: (word) => `选择与 ${word} 构成缩写关系的单词`,
};

export function instructionForTaskType(taskType: LearningTaskType): string {
  switch (taskType) {
    case LearningTaskType.MEANING_CHOICE:
      return "选出正确意思";
    case LearningTaskType.RELATION_CHOICE:
      return "选出相关的单词";
    case LearningTaskType.CONFUSABLE_CHOICE:
      return "选出容易混淆的单词";
    case LearningTaskType.ACTIVE_RECALL_TYPING:
      return "根据中文写出英文单词";
    case LearningTaskType.SPELLING_RECALL_TYPING:
      return "拼写这个单词";
  }
}

export function formatTaskPrompt(prompt: TaskPrompt): {
  instruction?: string;
  headline: string;
} {
  if (prompt.kind === "LEXEME_TEXT") {
    return { headline: prompt.text };
  }
  if (prompt.kind === "MEANING_TEXT") {
    return { headline: prompt.text };
  }
  return {
    instruction: RELATION_COPY[prompt.relationType](prompt.sourceText),
    headline: prompt.sourceText,
  };
}
