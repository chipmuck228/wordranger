import { MasteryStage } from "@/domain/learning/mastery-stage";
import { RetentionState } from "@/domain/learning/retention-state";
import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type {
  LearningNeedCandidate,
  SchedulerLexemeRef,
  UserMarkedLexeme,
} from "./learning-need-candidate";
import { preferredPromptModesForSkill } from "./session-plan";
import {
  selectFadingRecoverySkill,
  selectReviewSkill,
  selectStageProgressSkill,
} from "./stage-skill-map";
import { shouldDeferHealthyStageProgress } from "./stage-progress-deferral";
import { targetSkillForWeakness } from "./weakness-skill-map";
import type { SchedulerPolicy } from "./scheduler-policy";
import { DEFAULT_SCHEDULER_POLICY } from "./scheduler-policy";

export interface LearningNeedGenerationInput {
  lexemes: SchedulerLexemeRef[];
  models: StudentLexemeModel[];
  now: string;
  userMarkedLexemes?: UserMarkedLexeme[];
  createId: () => string;
  policy?: SchedulerPolicy;
}

export interface LearningNeedGenerator {
  generateCandidates(input: LearningNeedGenerationInput): LearningNeedCandidate[];
}

function byNewWordOrder(left: SchedulerLexemeRef, right: SchedulerLexemeRef): number {
  if (left.sourceIndex !== right.sourceIndex) {
    return left.sourceIndex - right.sourceIndex;
  }
  return left.canonicalKey.localeCompare(right.canonicalKey);
}

export class DefaultLearningNeedGenerator implements LearningNeedGenerator {
  generateCandidates(input: LearningNeedGenerationInput): LearningNeedCandidate[] {
    const policy = input.policy ?? DEFAULT_SCHEDULER_POLICY;
    const modelByLexeme = new Map(input.models.map((model) => [model.lexemeId, model]));
    const knownIds = new Set(input.lexemes.map((lexeme) => lexeme.id));
    const candidates: LearningNeedCandidate[] = [];

    const unseen = [...input.lexemes]
      .filter((lexeme) => {
        const model = modelByLexeme.get(lexeme.id);
        return !model || model.masteryStage === MasteryStage.UNSEEN;
      })
      .sort(byNewWordOrder);

    for (const lexeme of unseen) {
      candidates.push(
        makeCandidate(input, policy, {
          lexemeId: lexeme.id,
          skill: VocabularySkill.MEANING_RECOGNITION,
          reason: "NEW_WORD",
          ruleId: "NEW_WORD_UNSEEN",
          explanation: "No student model yet, or mastery stage is UNSEEN",
        }),
      );
    }

    for (const model of input.models) {
      if (!knownIds.has(model.lexemeId)) {
        continue;
      }
      if (model.masteryStage === MasteryStage.UNSEEN) {
        continue;
      }

      for (const weakness of model.weaknesses) {
        if (weakness.resolvedAt !== null) {
          continue;
        }
        const skill = targetSkillForWeakness(weakness);
        if (!skill) {
          continue;
        }
        candidates.push(
          makeCandidate(input, policy, {
            lexemeId: model.lexemeId,
            skill,
            reason: "WEAKNESS",
            ruleId: `WEAKNESS_${weakness.type}`,
            explanation: `${weakness.type} weakness severity ${weakness.severity.toFixed(2)}`,
            weaknessFocus: {
              weaknessId: weakness.id,
              type: weakness.type,
              relatedLexemeId: weakness.relatedLexemeId,
            },
            metadata: { severity: weakness.severity },
          }),
        );
      }

      if (
        model.nextReviewAt !== null &&
        Date.parse(model.nextReviewAt) <= Date.parse(input.now)
      ) {
        const skill = selectReviewSkill(model);
        if (skill) {
          const days = Math.max(
            0,
            (Date.parse(input.now) - Date.parse(model.nextReviewAt)) /
              (24 * 60 * 60 * 1000),
          );
          candidates.push(
            makeCandidate(input, policy, {
              lexemeId: model.lexemeId,
              skill,
              reason: "REVIEW_DUE",
              ruleId: "REVIEW_DUE",
              explanation: `Review overdue by ${days.toFixed(1)} days`,
            }),
          );
        }
      }

      const stageSkill = selectStageProgressSkill(model);
      if (
        stageSkill &&
        !shouldDeferHealthyStageProgress(model, stageSkill, input.now, policy)
      ) {
        candidates.push(
          makeCandidate(input, policy, {
            lexemeId: model.lexemeId,
            skill: stageSkill,
            reason: "STAGE_PROGRESS",
            ruleId: `STAGE_PROGRESS_${model.masteryStage}`,
            explanation: `Mastery stage ${model.masteryStage} needs evidence on ${stageSkill}`,
          }),
        );
      }

      if (model.retentionState === RetentionState.FADING) {
        const weaknessSkill = model.weaknesses
          .filter((item) => item.resolvedAt === null)
          .sort((left, right) => right.severity - left.severity)[0];
        const skill = selectFadingRecoverySkill(
          model,
          weaknessSkill ? targetSkillForWeakness(weaknessSkill) : null,
        );
        candidates.push(
          makeCandidate(input, policy, {
            lexemeId: model.lexemeId,
            skill,
            reason: "FADING",
            ruleId: "FADING_RECOVERY",
            explanation: "Retention state FADING requires recovery",
          }),
        );
      }
    }

    for (const marked of input.userMarkedLexemes ?? []) {
      if (!knownIds.has(marked.lexemeId)) {
        candidates.push(
          makeCandidate(input, policy, {
            lexemeId: marked.lexemeId,
            skill: marked.preferredSkill ?? VocabularySkill.MEANING_RECOGNITION,
            reason: "USER_MARKED",
            ruleId: "USER_MARKED_INVALID",
            explanation: "User-marked lexeme is not in the vocabulary list",
            metadata: { invalidLexeme: true },
          }),
        );
        continue;
      }
      candidates.push(
        makeCandidate(input, policy, {
          lexemeId: marked.lexemeId,
          skill: marked.preferredSkill ?? VocabularySkill.MEANING_RECOGNITION,
          reason: "USER_MARKED",
          ruleId: "USER_MARKED",
          explanation: `User marked this lexeme at ${marked.markedAt}`,
        }),
      );
    }

    return candidates;
  }
}

function makeCandidate(
  input: LearningNeedGenerationInput,
  policy: SchedulerPolicy,
  params: {
    lexemeId: string;
    skill: VocabularySkill;
    reason: LearningNeedCandidate["reason"];
    ruleId: string;
    explanation: string;
    weaknessFocus?: LearningNeedCandidate["weaknessFocus"];
    metadata?: Record<string, unknown>;
  },
): LearningNeedCandidate {
  return {
    id: input.createId(),
    lexemeId: params.lexemeId,
    targetSkill: params.skill,
    reason: params.reason,
    basePriority: policy.reasonWeights[params.reason],
    weaknessFocus: params.weaknessFocus,
    preferredPromptModes: preferredPromptModesForSkill(params.skill),
    source: {
      ruleId: params.ruleId,
      explanation: params.explanation,
    },
    metadata: params.metadata,
  };
}
