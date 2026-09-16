import type { LearningEvidence } from "../evidence.types";
import type { LearningPolicy } from "../policies/learning-policy";
import type { StudentLexemeModel } from "../student-lexeme-model";
import { clamp01 } from "./math";
import { isIndependentSuccess, isSkipped } from "./evidence-helpers";
import { calendarDay, distinctCount } from "./time";
import { VocabularySkill } from "../vocabulary-skill";

export interface CalculateMasteryScoreInput {
  model: StudentLexemeModel;
  history: readonly LearningEvidence[];
  policy: LearningPolicy;
}

export interface MasteryScoreResult {
  masteryScore: number;
  masteryConfidence: number;
}

export function calculateMasteryScore(
  input: CalculateMasteryScoreInput,
): MasteryScoreResult {
  const { model, history, policy } = input;
  const weights = policy.mastery.skillWeights;
  const masteryScore = clamp01(
    (Object.keys(weights) as VocabularySkill[]).reduce((sum, skill) => {
      return sum + model.skills[skill].score * weights[skill];
    }, 0),
  );

  const countable = history.filter((item) => !isSkipped(item));
  const w = policy.confidence.masteryWeights;
  const masteryConfidence = clamp01(
    w.evidence *
      Math.min(1, countable.length / policy.confidence.masteryEvidenceDenom) +
      w.sessions *
        Math.min(
          1,
          distinctCount(history.map((item) => item.sessionId)) /
            policy.confidence.masterySessionDenom,
        ) +
      w.days *
        Math.min(
          1,
          distinctCount(history.map((item) => calendarDay(item.occurredAt))) /
            policy.confidence.masteryDayDenom,
        ) +
      w.taskTypes *
        Math.min(
          1,
          distinctCount(history.map((item) => item.taskType)) /
            policy.confidence.masteryTaskTypeDenom,
        ) +
      w.independent *
        Math.min(
          1,
          history.filter(isIndependentSuccess).length /
            policy.confidence.masteryIndependentDenom,
        ),
  );

  return { masteryScore, masteryConfidence };
}
