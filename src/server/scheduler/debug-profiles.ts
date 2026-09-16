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
import type { UserMarkedLexeme } from "@/domain/scheduler/learning-need-candidate";
import type { Lexeme } from "@/domain/vocabulary/lexeme";

export const SCHEDULER_DEBUG_USER_ID = "debug-user";
export const SCHEDULER_DEBUG_NOW = "2026-09-16T12:00:00.000Z";

export type SchedulerDebugProfileId =
  | "new"
  | "review"
  | "fading"
  | "weakness"
  | "mixed";

function pickLemma(lexemes: Lexeme[], lemma: string, fallbackIndex: number): Lexeme {
  return (
    lexemes.find((item) => item.lemma === lemma) ??
    lexemes[Math.min(fallbackIndex, lexemes.length - 1)]
  );
}

function takeExcept(lexemes: Lexeme[], count: number, except: Set<string>): Lexeme[] {
  const selected: Lexeme[] = [];
  for (const lexeme of lexemes) {
    if (except.has(lexeme.id)) {
      continue;
    }
    selected.push(lexeme);
    if (selected.length >= count) {
      break;
    }
  }
  return selected;
}

function skillState(
  skill: VocabularySkill,
  score: number,
  confidence: number,
  attempts: number,
): StudentLexemeModel["skills"][VocabularySkill] {
  return {
    ...createInitialSkillState(skill),
    score,
    confidence,
    totalAttempts: attempts,
    correctAttempts: Math.max(0, attempts - 1),
    lastPracticedAt: SCHEDULER_DEBUG_NOW,
  };
}

function weakness(params: {
  id: string;
  type: WeaknessType;
  severity: number;
  skill?: VocabularySkill;
  relatedLexemeId?: string;
}): Weakness {
  return {
    id: params.id,
    type: params.type,
    severity: params.severity,
    skill: params.skill,
    relatedLexemeId: params.relatedLexemeId,
    reason: { code: params.type, evidenceIds: [] },
    detectedAt: "2026-09-01T00:00:00.000Z",
    lastTriggeredAt: "2026-09-10T00:00:00.000Z",
    resolvedAt: null,
  };
}

function model(params: {
  lexeme: Lexeme;
  index: number;
  stage: MasteryStage;
  retention?: RetentionState;
  nextReviewAt?: string | null;
  skills?: Partial<Record<VocabularySkill, { score: number; confidence: number; attempts?: number }>>;
  weaknesses?: Weakness[];
}): StudentLexemeModel {
  const snapshot = createInitialStudentLexemeModel({
    id: `debug-model-${params.index}`,
    userId: SCHEDULER_DEBUG_USER_ID,
    lexemeId: params.lexeme.id,
    now: SCHEDULER_DEBUG_NOW,
    policyVersion: DEFAULT_LEARNING_POLICY.version,
  });
  const skills = Object.fromEntries(
    VOCABULARY_SKILLS.map((skill) => {
      const override = params.skills?.[skill];
      if (!override) {
        return [skill, snapshot.skills[skill]];
      }
      return [
        skill,
        skillState(
          skill,
          override.score,
          override.confidence,
          override.attempts ?? 4,
        ),
      ];
    }),
  ) as StudentLexemeModel["skills"];
  return {
    ...snapshot,
    masteryStage: params.stage,
    retentionState: params.retention ?? RetentionState.STABLE,
    nextReviewAt: params.nextReviewAt === undefined ? "2026-09-10T00:00:00.000Z" : params.nextReviewAt,
    reviewIntervalDays: 2,
    firstSeenAt: "2026-08-01T00:00:00.000Z",
    lastSeenAt: "2026-09-10T00:00:00.000Z",
    skills,
    weaknesses: params.weaknesses ?? [],
    evidenceCount: 6,
    distinctPracticeDays: 3,
    distinctTaskTypes: 3,
  };
}

const DUE = "2026-09-10T00:00:00.000Z";
const FUTURE = "2026-12-01T00:00:00.000Z";

export function buildSchedulerDebugProfile(
  profileId: SchedulerDebugProfileId,
  lexemes: Lexeme[],
): {
  models: StudentLexemeModel[];
  userMarkedLexemes: UserMarkedLexeme[];
} {
  if (lexemes.length === 0) {
    return { models: [], userMarkedLexemes: [] };
  }
  const quiet = pickLemma(lexemes, "quiet", 0);
  const quite = pickLemma(lexemes, "quite", 1);
  const environment = pickLemma(lexemes, "environment", 2);
  const increase = pickLemma(lexemes, "increase", 3);
  const used = new Set([quiet.id, quite.id, environment.id, increase.id]);
  const extra = takeExcept(lexemes, 24, used);

  if (profileId === "new") {
    return {
      models: [
        model({
          lexeme: quiet,
          index: 1,
          stage: MasteryStage.EXPOSED,
          nextReviewAt: FUTURE,
          skills: {
            [VocabularySkill.MEANING_RECOGNITION]: { score: 0.35, confidence: 0.2, attempts: 2 },
          },
        }),
        model({
          lexeme: environment,
          index: 2,
          stage: MasteryStage.EXPOSED,
          nextReviewAt: FUTURE,
          skills: {
            [VocabularySkill.MEANING_RECOGNITION]: { score: 0.4, confidence: 0.25, attempts: 2 },
          },
        }),
      ],
      userMarkedLexemes: [],
    };
  }

  if (profileId === "review") {
    const reviewLexemes = [quiet, environment, increase, ...extra.slice(0, 12)];
    return {
      models: reviewLexemes.map((lexeme, index) =>
        model({
          lexeme,
          index,
          stage: index % 2 === 0 ? MasteryStage.RECOGNIZED : MasteryStage.CONNECTED,
          nextReviewAt: DUE,
          skills: {
            [VocabularySkill.MEANING_RECOGNITION]: { score: 0.72, confidence: 0.6, attempts: 6 },
            [VocabularySkill.SEMANTIC_CONNECTION]: { score: 0.58, confidence: 0.45, attempts: 4 },
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.4, confidence: 0.3, attempts: 3 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.55, confidence: 0.4, attempts: 3 },
          },
        }),
      ),
      userMarkedLexemes: [],
    };
  }

  if (profileId === "fading") {
    const fadingLexemes = [quiet, environment, increase, ...extra.slice(0, 5)];
    return {
      models: fadingLexemes.map((lexeme, index) =>
        model({
          lexeme,
          index,
          stage: MasteryStage.RECALLED,
          retention: RetentionState.FADING,
          nextReviewAt: DUE,
          skills: {
            [VocabularySkill.MEANING_RECOGNITION]: { score: 0.8, confidence: 0.7, attempts: 8 },
            [VocabularySkill.SEMANTIC_CONNECTION]: { score: 0.7, confidence: 0.6, attempts: 5 },
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.62, confidence: 0.4, attempts: 5 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.5, confidence: 0.35, attempts: 5 },
          },
        }),
      ),
      userMarkedLexemes: [],
    };
  }

  if (profileId === "weakness") {
    const weaknessLexemes = [quiet, environment, increase, ...extra.slice(0, 7)];
    return {
      models: weaknessLexemes.map((lexeme, index) =>
        model({
          lexeme,
          index,
          stage: MasteryStage.CONNECTED,
          nextReviewAt: DUE,
          skills: {
            [VocabularySkill.MEANING_RECOGNITION]: { score: 0.7, confidence: 0.55, attempts: 6 },
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.35, confidence: 0.25, attempts: 4 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.28, confidence: 0.2, attempts: 4 },
          },
          weaknesses: [
            weakness({
              id: `w-spell-${index}`,
              type: WeaknessType.SPELLING,
              severity: 0.55 + (index % 4) * 0.1,
            }),
            ...(index % 3 === 0
              ? [
                  weakness({
                    id: `w-conf-${index}`,
                    type: WeaknessType.CONFUSION,
                    severity: 0.6,
                    skill: VocabularySkill.MEANING_RECOGNITION,
                    relatedLexemeId: quite.id,
                  }),
                ]
              : []),
          ],
        }),
      ),
      userMarkedLexemes: [],
    };
  }

  const mixedExtra = extra.slice(0, 8);
  return {
    models: [
      model({
        lexeme: quiet,
        index: 1,
        stage: MasteryStage.CONNECTED,
        nextReviewAt: DUE,
        skills: {
          [VocabularySkill.SPELLING_RECALL]: { score: 0.25, confidence: 0.2, attempts: 5 },
          [VocabularySkill.ACTIVE_RECALL]: { score: 0.55, confidence: 0.4, attempts: 4 },
        },
        weaknesses: [
          weakness({
            id: "w-quiet-spell",
            type: WeaknessType.SPELLING,
            severity: 0.72,
          }),
        ],
      }),
      model({
        lexeme: environment,
        index: 2,
        stage: MasteryStage.RECALLED,
        retention: RetentionState.FADING,
        nextReviewAt: DUE,
        skills: {
          [VocabularySkill.ACTIVE_RECALL]: { score: 0.6, confidence: 0.45, attempts: 6 },
          [VocabularySkill.SPELLING_RECALL]: { score: 0.48, confidence: 0.3, attempts: 5 },
        },
      }),
      model({
        lexeme: increase,
        index: 3,
        stage: MasteryStage.USABLE,
        nextReviewAt: DUE,
        skills: {
          [VocabularySkill.MEANING_RECOGNITION]: { score: 0.85, confidence: 0.7, attempts: 8 },
          [VocabularySkill.ACTIVE_RECALL]: { score: 0.7, confidence: 0.6, attempts: 6 },
          [VocabularySkill.SPELLING_RECALL]: { score: 0.68, confidence: 0.55, attempts: 5 },
          [VocabularySkill.CONTEXT_USE]: { score: 0.4, confidence: 0.3, attempts: 2 },
        },
      }),
      model({
        lexeme: quite,
        index: 4,
        stage: MasteryStage.MASTERED,
        nextReviewAt: DUE,
        skills: {
          [VocabularySkill.MEANING_RECOGNITION]: { score: 0.9, confidence: 0.8, attempts: 10 },
          [VocabularySkill.ACTIVE_RECALL]: { score: 0.82, confidence: 0.7, attempts: 8 },
          [VocabularySkill.SPELLING_RECALL]: { score: 0.8, confidence: 0.7, attempts: 7 },
        },
      }),
      ...mixedExtra.map((lexeme, index) =>
        model({
          lexeme,
          index: index + 10,
          stage: MasteryStage.RECOGNIZED,
          nextReviewAt: index % 2 === 0 ? DUE : FUTURE,
          skills: {
            [VocabularySkill.MEANING_RECOGNITION]: { score: 0.65, confidence: 0.5, attempts: 5 },
            [VocabularySkill.SEMANTIC_CONNECTION]: { score: 0.4, confidence: 0.3, attempts: 3 },
          },
        }),
      ),
    ],
    userMarkedLexemes: [
      {
        lexemeId: extra[8]?.id ?? quiet.id,
        markedAt: SCHEDULER_DEBUG_NOW,
        preferredSkill: VocabularySkill.MEANING_RECOGNITION,
      },
    ],
  };
}
