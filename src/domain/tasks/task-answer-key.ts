export interface TaskAnswerKey {
  taskId: string;
  targetLexemeId: string;
  correctOptionIds: string[];
  optionLexemeIds: Record<string, string | null>;
  exactAcceptedTexts: string[];
  semanticAcceptedTexts: string[];
  relationId?: string;
  confusionLexemeIds?: string[];
}
