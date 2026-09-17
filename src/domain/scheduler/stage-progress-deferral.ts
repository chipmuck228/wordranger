import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { SchedulerPolicy } from "./scheduler-policy";
import { targetSkillForWeakness } from "./weakness-skill-map";

/**
 * After a strong independent success, STAGE_PROGRESS on the same skill waits
 * until `nextReviewAt`. Failures, assisted results, and unresolved weaknesses
 * stay on the immediate learning path. Does not mark the lexeme MASTERED.
 */
export function shouldDeferHealthyStageProgress(
  model: StudentLexemeModel,
  targetSkill: VocabularySkill,
  now: string,
  policy: SchedulerPolicy,
): boolean {
  if (!policy.progression.deferHealthyStageProgressUntilReviewDue) {
    return false;
  }
  const skillState = model.skills[targetSkill];
  if (!skillState || skillState.consecutiveIndependentSuccesses < 1) {
    return false;
  }
  if (
    model.lastFailureAt &&
    (!model.lastSuccessAt ||
      Date.parse(model.lastFailureAt) >= Date.parse(model.lastSuccessAt))
  ) {
    return false;
  }
  const blockedByWeakness = model.weaknesses.some(
    (weakness) =>
      weakness.resolvedAt === null &&
      targetSkillForWeakness(weakness) === targetSkill,
  );
  if (blockedByWeakness) {
    return false;
  }
  if (
    !model.nextReviewAt ||
    Date.parse(model.nextReviewAt) <= Date.parse(now)
  ) {
    return false;
  }
  return true;
}
