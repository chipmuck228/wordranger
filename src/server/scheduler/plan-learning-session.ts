import type { RandomSource } from "@/domain/tasks/random-source";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
import {
  DEFAULT_SCHEDULER_POLICY,
  DeterministicScheduler,
  type LearningSessionPlan,
  type SchedulerPolicy,
  type UserMarkedLexeme,
} from "@/domain/scheduler";
import type { LearningStateQueryRepository } from "./learning-state-query-repository";
import { buildVocabularyLearningContentCapability } from "./vocabulary-learning-content-capability";

export interface ScheduleLearningSessionRequest {
  userId: string;
  now: string;
  requestedNeedCount?: number;
  userMarkedLexemes?: UserMarkedLexeme[];
  createId: () => string;
  random: RandomSource;
  vocabulary: VocabularyRepository;
  query: LearningStateQueryRepository;
  policy?: SchedulerPolicy;
  scheduler?: DeterministicScheduler;
}

export async function planLearningSession(
  request: ScheduleLearningSessionRequest,
): Promise<LearningSessionPlan> {
  const policy = request.policy ?? DEFAULT_SCHEDULER_POLICY;
  const [lexemes, relations, models, recentActivity] = await Promise.all([
    request.vocabulary.listLexemes(),
    request.vocabulary.listRelations(),
    request.query.listStudentLexemeModels(request.userId),
    request.query.getRecentLearningActivity(
      request.userId,
      Math.max(policy.recency.recentActivityWindow, 40),
    ),
  ]);
  const capability = buildVocabularyLearningContentCapability(
    lexemes,
    relations,
  );
  const scheduler = request.scheduler ?? new DeterministicScheduler();
  return scheduler.planSession({
    userId: request.userId,
    now: request.now,
    lexemes: lexemes.map((lexeme) => ({
      id: lexeme.id,
      sourceIndex: lexeme.sourceIndex,
      canonicalKey: lexeme.canonicalKey,
    })),
    models,
    recentActivity,
    userMarkedLexemes: request.userMarkedLexemes,
    requestedNeedCount: request.requestedNeedCount,
    createId: request.createId,
    random: request.random,
    policy,
    capability,
  });
}
