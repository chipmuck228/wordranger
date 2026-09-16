import { DEFAULT_LEARNING_POLICY } from "@/domain/learning/policies/default-learning-policy";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { RetentionState } from "@/domain/learning/retention-state";
import {
  createInitialSkillState,
  createInitialStudentLexemeModel,
  type StudentLexemeModel,
} from "@/domain/learning/student-lexeme-model";
import { VOCABULARY_SKILLS, VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType, type Weakness } from "@/domain/learning/weakness.types";
import {
  DEFAULT_SCHEDULER_POLICY,
  DeterministicScheduler,
  type SchedulerInput,
  type SchedulerLexemeRef,
  type SchedulerPolicy,
} from "@/domain/scheduler";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { sequentialIdFactory } from "../learning/helpers";

export const NOW = "2026-09-16T12:00:00.000Z";
export const USER_ID = "scheduler-user";

export function makeLexeme(
  id: string,
  sourceIndex = 1,
  canonicalKey = id,
): SchedulerLexemeRef {
  return { id, sourceIndex, canonicalKey };
}

export function makeWeakness(overrides: Partial<Weakness> & Pick<Weakness, "id" | "type">): Weakness {
  return {
    severity: 0.6,
    reason: { code: overrides.type, evidenceIds: [] },
    detectedAt: NOW,
    lastTriggeredAt: NOW,
    resolvedAt: null,
    ...overrides,
  };
}

export function makeModel(
  lexemeId: string,
  overrides: Partial<StudentLexemeModel> & {
    skillScores?: Partial<
      Record<VocabularySkill, { score: number; confidence: number; attempts?: number }>
    >;
  } = {},
): StudentLexemeModel {
  const { skillScores, ...rest } = overrides;
  const model = createInitialStudentLexemeModel({
    id: rest.id ?? `model-${lexemeId}`,
    userId: rest.userId ?? USER_ID,
    lexemeId,
    now: NOW,
    policyVersion: DEFAULT_LEARNING_POLICY.version,
  });
  const skills = Object.fromEntries(
    VOCABULARY_SKILLS.map((skill) => {
      const override = skillScores?.[skill];
      if (!override) {
        return [skill, model.skills[skill]];
      }
      return [
        skill,
        {
          ...createInitialSkillState(skill),
          score: override.score,
          confidence: override.confidence,
          totalAttempts: override.attempts ?? 3,
          correctAttempts: Math.max(0, (override.attempts ?? 3) - 1),
        },
      ];
    }),
  ) as StudentLexemeModel["skills"];
  return {
    ...model,
    ...rest,
    lexemeId,
    skills,
    weaknesses: rest.weaknesses ?? model.weaknesses,
  };
}

export function plan(
  input: Partial<SchedulerInput> &
    Pick<SchedulerInput, "lexemes" | "models">,
) {
  const scheduler = new DeterministicScheduler();
  return scheduler.planSession({
    userId: USER_ID,
    now: NOW,
    recentActivity: [],
    createId: sequentialIdFactory("sid"),
    random: new SeededRandomSource("scheduler-test"),
    policy: DEFAULT_SCHEDULER_POLICY,
    ...input,
  });
}

export function policyWith(
  overrides: Partial<SchedulerPolicy> & {
    session?: Partial<SchedulerPolicy["session"]>;
    diversity?: Partial<SchedulerPolicy["diversity"]>;
  },
): SchedulerPolicy {
  return {
    ...DEFAULT_SCHEDULER_POLICY,
    ...overrides,
    session: { ...DEFAULT_SCHEDULER_POLICY.session, ...overrides.session },
    diversity: {
      ...DEFAULT_SCHEDULER_POLICY.diversity,
      ...overrides.diversity,
    },
  };
}

export { MasteryStage, RetentionState, VocabularySkill, WeaknessType, sequentialIdFactory };
