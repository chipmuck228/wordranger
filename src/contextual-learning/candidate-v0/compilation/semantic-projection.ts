/**
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Explicit whitelist of Candidate cognition → frozen Evidence mappings.
 * Transport compatibility is not a projection.
 */

import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LearningTaskType } from "@/domain/tasks/task-type";
import type {
  ExpectedSemanticResponseKind,
  ExperienceStepPurpose,
  ExperienceTargetFocus,
  SemanticAction,
} from "../domain/types";

export interface FrozenSemanticProjection {
  id: string;
  semanticAction: SemanticAction;
  responseKind: ExpectedSemanticResponseKind;
  targetFocus: ExperienceTargetFocus;
  stepPurpose: ExperienceStepPurpose;
  taskType: LearningTaskType;
  targetSkill: VocabularySkill;
  promptMode: PromptMode;
  answerMode: AnswerMode;
  justification: string;
}

const LEXICAL_RECALL_JUSTIFICATION =
  "Typing the target lexeme from a meaning cue is the same production act as frozen ACTIVE_RECALL_TYPING. Evidence.skill = ACTIVE_RECALL therefore describes the cognition actually tested.";

function lexicalRecallProjection(
  action: Extract<SemanticAction, "RECALL" | "TYPE">,
): FrozenSemanticProjection {
  return {
    id: `lexical-form-${action.toLowerCase()}-recall-to-active-recall`,
    semanticAction: action,
    responseKind: "LEXICAL_FORM",
    targetFocus: "MEANING_TO_FORM",
    stepPurpose: "RECALL",
    taskType: LearningTaskType.ACTIVE_RECALL_TYPING,
    targetSkill: VocabularySkill.ACTIVE_RECALL,
    promptMode: PromptMode.MEANING_TO_WORD,
    answerMode: AnswerMode.TYPING,
    justification: LEXICAL_RECALL_JUSTIFICATION,
  };
}

export const SEMANTIC_PROJECTION_WHITELIST: readonly FrozenSemanticProjection[] =
  [lexicalRecallProjection("RECALL"), lexicalRecallProjection("TYPE")];

export interface SemanticProjectionQuery {
  semanticAction: SemanticAction;
  responseKind: ExpectedSemanticResponseKind;
  targetFocus: ExperienceTargetFocus;
  stepPurpose: ExperienceStepPurpose;
}

export function findSemanticProjection(
  query: SemanticProjectionQuery,
): FrozenSemanticProjection | undefined {
  return SEMANTIC_PROJECTION_WHITELIST.find(
    (projection) =>
      projection.semanticAction === query.semanticAction &&
      projection.responseKind === query.responseKind &&
      projection.targetFocus === query.targetFocus &&
      projection.stepPurpose === query.stepPurpose,
  );
}
