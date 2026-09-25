"use server";

import { MasteryStage } from "@/domain/learning/mastery-stage";
import { RetentionState } from "@/domain/learning/retention-state";
import type { LearningNeed } from "@/domain/learning/learning-need";
import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { TaskAssignment } from "@/domain/tasks/task-assignment";
import type { TaskGenerationResult } from "@/domain/tasks/task-unavailable";
import type { LearningSessionPlan } from "@/domain/scheduler";
import { DEFAULT_SCHEDULER_POLICY } from "@/domain/scheduler";
import type { UserMarkedLexeme } from "@/domain/scheduler/learning-need-candidate";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import {
  buildSchedulerDebugProfile,
  SCHEDULER_DEBUG_NOW,
  SCHEDULER_DEBUG_USER_ID,
  type SchedulerDebugProfileId,
} from "@/server/scheduler/debug-profiles";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import {
  submitTaskAction,
  type SubmitTaskActionResult,
} from "@/server/tasks/submit-task-action";
import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import {
  DEBUG_GAME_ID,
  DEBUG_NOW,
  DEBUG_SESSION_ID,
  DEBUG_USER_ID,
} from "./debug-ids";

const taskRepository = new InMemoryLearningTaskRepository();
const learningRepository = new InMemoryLearningRepository();
const queryRepository = new InMemoryLearningStateQueryRepository(learningRepository);
let userMarked: UserMarkedLexeme[] = [];
let nextSchedulerDebugTaskCreateIdSerial = 0;

function nextSchedulerDebugTaskCreateId(): string {
  nextSchedulerDebugTaskCreateIdSerial += 1;
  return `sched-task-${nextSchedulerDebugTaskCreateIdSerial}`;
}

export interface SchedulerOverview {
  totalLexemes: number;
  modelsByStage: Record<string, number>;
  retentionCounts: Record<string, number>;
  weaknessCount: number;
  dueCount: number;
  unseenCount: number;
  candidateCountByReason: Record<string, number>;
  blockedCountBySkill: Record<string, number>;
  blockedCountByReason: Record<string, number>;
}

function emptyCounts(keys: string[]): Record<string, number> {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function buildOverview(
  lexemeCount: number,
  models: StudentLexemeModel[],
  plan: LearningSessionPlan,
  now: string,
): SchedulerOverview {
  const modelsByStage = emptyCounts(Object.values(MasteryStage));
  const retentionCounts = emptyCounts(Object.values(RetentionState));
  for (const model of models) {
    modelsByStage[model.masteryStage] += 1;
    retentionCounts[model.retentionState] += 1;
  }
  const candidateCountByReason: Record<string, number> = {};
  for (const candidate of plan.trace.generatedCandidates) {
    candidateCountByReason[candidate.reason] =
      (candidateCountByReason[candidate.reason] ?? 0) + 1;
  }
  const blockedCountBySkill: Record<string, number> = {};
  const blockedCountByReason: Record<string, number> = {};
  for (const candidate of plan.trace.blockedCandidates) {
    blockedCountBySkill[candidate.skill] =
      (blockedCountBySkill[candidate.skill] ?? 0) + 1;
    const key = candidate.blockedReason ?? candidate.reason;
    blockedCountByReason[key] = (blockedCountByReason[key] ?? 0) + 1;
  }
  return {
    totalLexemes: lexemeCount,
    modelsByStage,
    retentionCounts,
    weaknessCount: models.reduce(
      (sum, model) =>
        sum + model.weaknesses.filter((item) => item.resolvedAt === null).length,
      0,
    ),
    dueCount: models.filter(
      (model) =>
        model.nextReviewAt !== null &&
        Date.parse(model.nextReviewAt) <= Date.parse(now),
    ).length,
    unseenCount: lexemeCount - models.filter((model) => model.masteryStage !== MasteryStage.UNSEEN).length,
    candidateCountByReason,
    blockedCountBySkill,
    blockedCountByReason,
  };
}

export async function loadSchedulerDebugProfile(profileId: SchedulerDebugProfileId): Promise<{
  modelCount: number;
  userMarkedCount: number;
}> {
  const dataset = getVocabularyDataset();
  const profile = buildSchedulerDebugProfile(profileId, dataset.lexemes);
  taskRepository.reset();
  learningRepository.reset();
  for (const snapshot of profile.models) {
    await learningRepository.saveStudentLexemeModel(snapshot);
  }
  userMarked = profile.userMarkedLexemes;
  return {
    modelCount: profile.models.length,
    userMarkedCount: profile.userMarkedLexemes.length,
  };
}

export async function planDebugSchedulerSession(input: {
  seed: string;
  requestedNeedCount?: number;
  now?: string;
}): Promise<{ plan: LearningSessionPlan; overview: SchedulerOverview }> {
  const dataset = getVocabularyDataset();
  const vocabulary = new InMemoryVocabularyRepository(dataset);
  const now = input.now ?? DEBUG_NOW;
  let count = 0;
  const plan = await planLearningSession({
    userId: DEBUG_USER_ID,
    now,
    requestedNeedCount: input.requestedNeedCount,
    userMarkedLexemes: userMarked,
    createId: () => `sched-${++count}`,
    random: new SeededRandomSource(input.seed || "scheduler-debug"),
    vocabulary,
    query: queryRepository,
    policy: DEFAULT_SCHEDULER_POLICY,
  });
  const models = learningRepository.listStudentLexemeModels(DEBUG_USER_ID);
  return {
    plan,
    overview: buildOverview(dataset.lexemes.length, models, plan, now),
  };
}

export async function generateTaskFromScheduledNeed(input: {
  need: LearningNeed;
  seed: string;
}): Promise<{
  generation: TaskGenerationResult;
  assignment: TaskAssignment | null;
}> {
  const vocabulary = new InMemoryVocabularyRepository(getVocabularyDataset());
  const generator = new DefaultTaskGenerator(vocabulary);
  const generation = await generator.generate({
    need: input.need,
    desiredDifficulty: 0.45,
    recentTasks: [],
    now: DEBUG_NOW,
    createId: nextSchedulerDebugTaskCreateId,
    random: new SeededRandomSource(input.seed || "scheduler-debug"),
  });
  if (generation.status !== "GENERATED") {
    return { generation, assignment: null };
  }
  const assignment: TaskAssignment = {
    userId: DEBUG_USER_ID,
    sessionId: DEBUG_SESSION_ID,
  };
  await taskRepository.saveGeneratedTask({
    task: generation.value,
    assignment,
  });
  return { generation, assignment };
}

export async function submitScheduledDebugTask(input: {
  taskId: string;
  action: StudentAction;
}): Promise<SubmitTaskActionResult> {
  return submitTaskAction({
    taskId: input.taskId,
    action: input.action,
    userId: DEBUG_USER_ID,
    sessionId: DEBUG_SESSION_ID,
    gameId: DEBUG_GAME_ID,
    evidenceId: crypto.randomUUID(),
    learningTaskRepository: taskRepository,
    learningRepository,
    now: input.action.occurredAt,
  });
}

export async function getAssignedSchedulerDebugTask(taskId: string) {
  return taskRepository.getTaskForEvaluation({
    taskId,
    userId: DEBUG_USER_ID,
    sessionId: DEBUG_SESSION_ID,
  });
}

export async function resetSchedulerDebugLab(): Promise<void> {
  taskRepository.reset();
  learningRepository.reset();
  userMarked = [];
}

export type { GeneratedLearningTask, LearningSessionPlan, SchedulerDebugProfileId };
export { SCHEDULER_DEBUG_NOW, SCHEDULER_DEBUG_USER_ID };
