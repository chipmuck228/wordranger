import { relationMeetsContentPolicy } from "@/domain/vocabulary/relation-policy";
import { DEFAULT_VOCABULARY_CONTENT_POLICY } from "@/domain/vocabulary/vocabulary-content-policy";
import type { VocabularyDataset } from "../load-vocabulary-dataset";
import { validateVocabularyDataset } from "../qa";

export interface ImportPlan {
  mode: "validate" | "dry-run" | "apply";
  sourceEntries: number;
  lexemes: number;
  relations: number;
  tags: number;
  rejectedRelations: number;
  qaIssueCount: number;
  qaIssues: string[];
}

export function planVocabularyImport(
  dataset: VocabularyDataset,
  mode: ImportPlan["mode"] = "dry-run",
): ImportPlan {
  const qa = validateVocabularyDataset(dataset);
  const rejectedRelations = dataset.relations.filter(
    (relation) =>
      !relationMeetsContentPolicy(relation, DEFAULT_VOCABULARY_CONTENT_POLICY),
  ).length;
  return {
    mode,
    sourceEntries: dataset.sourceEntries.length,
    lexemes: dataset.lexemes.length,
    relations: dataset.relations.length,
    tags: dataset.tags.length,
    rejectedRelations,
    qaIssueCount: qa.issues.length,
    qaIssues: qa.issues.map((issue) => `${issue.code}: ${issue.message}`),
  };
}
