import type { SupabaseClient } from "@supabase/supabase-js";
import { LearningDomainError } from "@/domain/learning/engine/math";
import type { RecentPerformanceItem } from "@/domain/learning/evidence.types";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { RetentionState } from "@/domain/learning/retention-state";
import {
  createInitialSkillState,
  type SkillState,
  type StudentLexemeModel,
} from "@/domain/learning/student-lexeme-model";
import { VOCABULARY_SKILLS, VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType, type Weakness, type WeaknessReason } from "@/domain/learning/weakness.types";
import type { RecentLearningActivity } from "@/domain/scheduler/learning-need-candidate";
import type { LearningStateQueryRepository } from "./learning-state-query-repository";
import { recentActivityFromEvidence } from "./recent-activity";

interface StudentLexemeModelRow {
  id: string;
  user_id: string;
  lexeme_id: string;
  policy_version: string;
  mastery_stage: string;
  retention_state: string;
  mastery_score: number;
  mastery_confidence: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  next_review_at: string | null;
  review_interval_days: number;
  evidence_count: number;
  distinct_practice_days: number;
  distinct_task_types: number;
  created_at: string;
  updated_at: string;
}

interface SkillStateRow {
  skill: string;
  score: number;
  confidence: number;
  total_attempts: number;
  correct_attempts: number;
  incorrect_attempts: number;
  assisted_attempts: number;
  consecutive_independent_successes: number;
  last_practiced_at: string | null;
  last_independent_success_at: string | null;
  recent_performance: RecentPerformanceItem[] | null;
  student_lexeme_model_id: string;
}

interface WeaknessRow {
  id: string;
  student_lexeme_model_id: string;
  type: string;
  skill: string | null;
  severity: number;
  related_lexeme_id: string | null;
  reason: WeaknessReason;
  detected_at: string;
  last_triggered_at: string;
  resolved_at: string | null;
}

interface EvidenceActivityRow {
  lexeme_id: string;
  skill: string;
  task_type: string | null;
  occurred_at: string;
}

function parseSkill(value: string): VocabularySkill {
  if ((Object.values(VocabularySkill) as string[]).includes(value)) {
    return value as VocabularySkill;
  }
  throw new LearningDomainError("INVALID_ROW", `Unknown skill ${value}`);
}

function mapSkill(row: SkillStateRow): SkillState {
  return {
    skill: parseSkill(row.skill),
    score: Number(row.score),
    confidence: Number(row.confidence),
    totalAttempts: row.total_attempts,
    correctAttempts: row.correct_attempts,
    incorrectAttempts: row.incorrect_attempts,
    assistedAttempts: row.assisted_attempts,
    consecutiveIndependentSuccesses: row.consecutive_independent_successes,
    lastPracticedAt: row.last_practiced_at,
    lastIndependentSuccessAt: row.last_independent_success_at,
    recentPerformance: row.recent_performance ?? [],
  };
}

function mapWeakness(row: WeaknessRow): Weakness {
  return {
    id: row.id,
    type: row.type as WeaknessType,
    severity: Number(row.severity),
    skill: row.skill ? parseSkill(row.skill) : undefined,
    relatedLexemeId: row.related_lexeme_id ?? undefined,
    reason: row.reason,
    detectedAt: row.detected_at,
    lastTriggeredAt: row.last_triggered_at,
    resolvedAt: row.resolved_at,
  };
}

function mapModel(
  row: StudentLexemeModelRow,
  skills: SkillStateRow[],
  weaknesses: WeaknessRow[],
): StudentLexemeModel {
  const skillRecord = Object.fromEntries(
    VOCABULARY_SKILLS.map((skill) => [skill, createInitialSkillState(skill)]),
  ) as StudentLexemeModel["skills"];
  for (const skillRow of skills) {
    const mapped = mapSkill(skillRow);
    skillRecord[mapped.skill] = mapped;
  }
  return {
    id: row.id,
    userId: row.user_id,
    lexemeId: row.lexeme_id,
    policyVersion: row.policy_version,
    masteryStage: row.mastery_stage as MasteryStage,
    retentionState: row.retention_state as RetentionState,
    masteryScore: Number(row.mastery_score),
    masteryConfidence: Number(row.mastery_confidence),
    skills: skillRecord,
    weaknesses: weaknesses.map(mapWeakness),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    nextReviewAt: row.next_review_at,
    reviewIntervalDays: Number(row.review_interval_days),
    evidenceCount: row.evidence_count,
    distinctPracticeDays: row.distinct_practice_days,
    distinctTaskTypes: row.distinct_task_types,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseLearningStateQueryRepository
  implements LearningStateQueryRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async listStudentLexemeModels(userId: string): Promise<StudentLexemeModel[]> {
    const { data, error } = await this.client
      .from("student_lexeme_models")
      .select("*")
      .eq("user_id", userId);
    if (error) {
      throw error;
    }
    const rows = (data ?? []) as StudentLexemeModelRow[];
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const [skills, weaknesses] = await Promise.all([
      this.client
        .from("student_lexeme_skill_states")
        .select("*")
        .in("student_lexeme_model_id", ids),
      this.client
        .from("student_lexeme_weaknesses")
        .select("*")
        .in("student_lexeme_model_id", ids),
    ]);
    if (skills.error) {
      throw skills.error;
    }
    if (weaknesses.error) {
      throw weaknesses.error;
    }
    const skillsByModel = new Map<string, SkillStateRow[]>();
    for (const row of (skills.data ?? []) as SkillStateRow[]) {
      const list = skillsByModel.get(row.student_lexeme_model_id) ?? [];
      list.push(row);
      skillsByModel.set(row.student_lexeme_model_id, list);
    }
    const weaknessesByModel = new Map<string, WeaknessRow[]>();
    for (const row of (weaknesses.data ?? []) as WeaknessRow[]) {
      const list = weaknessesByModel.get(row.student_lexeme_model_id) ?? [];
      list.push(row);
      weaknessesByModel.set(row.student_lexeme_model_id, list);
    }
    return rows.map((row) =>
      mapModel(
        row,
        skillsByModel.get(row.id) ?? [],
        weaknessesByModel.get(row.id) ?? [],
      ),
    );
  }

  async getRecentLearningActivity(
    userId: string,
    limit: number,
  ): Promise<RecentLearningActivity[]> {
    const { data, error } = await this.client
      .from("learning_evidence")
      .select("lexeme_id, skill, task_type, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw error;
    }
    const rows = (data ?? []) as EvidenceActivityRow[];
    return recentActivityFromEvidence(
      rows.map((row) => ({
        lexemeId: row.lexeme_id,
        skill: parseSkill(row.skill),
        taskType: row.task_type ?? "unknown",
        occurredAt: row.occurred_at,
      })),
    );
  }
}
