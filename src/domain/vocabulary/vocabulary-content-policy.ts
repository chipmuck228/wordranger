export interface VocabularyContentPolicy {
  minimumRelationConfidence: {
    sourceStructural: number;
    curatedModel: number;
    ruleInferred: number;
  };
  allowRuleInferredInProduction: boolean;
}

export const DEFAULT_VOCABULARY_CONTENT_POLICY: VocabularyContentPolicy = {
  minimumRelationConfidence: {
    sourceStructural: 0.95,
    curatedModel: 0.8,
    ruleInferred: 1,
  },
  allowRuleInferredInProduction: false,
};
