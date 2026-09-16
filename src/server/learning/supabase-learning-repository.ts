import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningEvidence } from "@/domain/learning/evidence.types";
import {
  AnswerMode,
  EvidenceErrorType,
  EvidenceOutcome,
  PromptMode,
} from "@/domain/learning/evidence.types";
import type { LearningRepository } from "@/domain/learning/learning-repository";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { RetentionState } from "@/domain/learning/retention-state";
import {
  createInitialSkillState,
  type SkillState,
  type StudentLexemeModel,
} from "@/domain/learning/student-lexeme-model";
import { VOCABULARY_SKILLS, VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { Weakness, WeaknessReason } from "@/domain/learning/weakness.types";
import { WeaknessType } from "@/domain/learning/weakness.types";
import type { RecentPerformanceItem } from "@/domain/learning/evidence.types";
import { LearningDomainError } from "@/domain/learning/engine/math";

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
  id: string;
  student_lexeme_model_id: string;
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
  updated_at: string;
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

interface EvidenceRow {
  id: string;
  user_id: string;
  lexeme_id: string;
  task_id: string | null;
  session_id: string | null;
  game_id: string | null;
  task_type: string | null;
  skill: string;
  prompt_mode: string;
  answer_mode: string;
  outcome: string;
  response_time_ms: number | null;
  hint_count: number;
  difficulty: number;
  distractor_lexeme_ids: string[] | null;
  selected_lexeme_id: string | null;
  typed_answer: string | null;
  expected_answer: string | null;
  error_type: string | null;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
}

function parseSkill(value: string): VocabularySkill {
  if ((Object.values(VocabularySkill) as string[]).includes(value)) {
    return value as VocabularySkill;
  }
  throw new LearningDomainError("INVALID_ROW", `Unknown skill ${value}`);
}

function mapEvidence(row: EvidenceRow): LearningEvidence {
  return {
    id: row.id,
    userId: row.user_id,
    lexemeId: row.lexeme_id,
    taskId: row.task_id,
    sessionId: row.session_id ?? "",
    gameId: row.game_id ?? "unknown",
    taskType: row.task_type ?? "unknown",
    skill: parseSkill(row.skill),
    promptMode: row.prompt_mode as PromptMode,
    answerMode: row.answer_mode as AnswerMode,
    outcome: row.outcome as EvidenceOutcome,
    responseTimeMs: row.response_time_ms,
    hintCount: row.hint_count,
    difficulty: Number(row.difficulty),
    distractorLexemeIds: row.distractor_lexeme_ids ?? [],
    selectedLexemeId: row.selected_lexeme_id,
    typedAnswer: row.typed_answer,
    expectedAnswer: row.expected_answer,
    errorType: row.error_type as EvidenceErrorType | null,
    occurredAt: row.occurred_at,
    metadata: row.metadata ?? undefined,
  };
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

export class SupabaseLearningRepository implements LearningRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getStudentLexemeModel(
    userId: string,
    lexemeId: string,
  ): Promise<StudentLexemeModel | null> {
    const { data, error } = await this.client
      .from("student_lexeme_models")
      .select("*")
      .eq("user_id", userId)
      .eq("lexeme_id", lexemeId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    const row = data as StudentLexemeModelRow;
    const [skills, weaknesses] = await Promise.all([
      this.client
        .from("student_lexeme_skill_states")
        .select("*")
        .eq("student_lexeme_model_id", row.id),
      this.client
        .from("student_lexeme_weaknesses")
        .select("*")
        .eq("student_lexeme_model_id", row.id),
    ]);
    if (skills.error) {
      throw skills.error;
    }
    if (weaknesses.error) {
      throw weaknesses.error;
    }
    return mapModel(
      row,
      (skills.data ?? []) as SkillStateRow[],
      (weaknesses.data ?? []) as WeaknessRow[],
    );
  }

  async getEvidenceForLexeme(
    userId: string,
    lexemeId: string,
  ): Promise<LearningEvidence[]> {
    const { data, error } = await this.client
      .from("learning_evidence")
      .select("*")
      .eq("user_id", userId)
      .eq("lexeme_id", lexemeId)
      .order("occurred_at", { ascending: true });
    if (error) {
      throw error;
    }
    return ((data ?? []) as EvidenceRow[]).map(mapEvidence);
  }

  async getRecentEvidence(
    userId: string,
    lexemeId: string,
    limit = 20,
  ): Promise<LearningEvidence[]> {
    const { data, error } = await this.client
      .from("learning_evidence")
      .select("*")
      .eq("user_id", userId)
      .eq("lexeme_id", lexemeId)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw error;
    }
    return ((data ?? []) as EvidenceRow[]).map(mapEvidence);
  }

  async appendEvidence(evidence: LearningEvidence): Promise<void> {
    const { error } = await this.client.from("learning_evidence").insert({
      id: evidence.id,
      user_id: evidence.userId,
      lexeme_id: evidence.lexemeId,
      task_id: evidence.taskId,
      session_id: evidence.sessionId,
      game_id: evidence.gameId,
      task_type: evidence.taskType,
      skill: evidence.skill,
      prompt_mode: evidence.promptMode,
      answer_mode: evidence.answerMode,
      outcome: evidence.outcome,
      response_time_ms: evidence.responseTimeMs,
      hint_count: evidence.hintCount,
      difficulty: evidence.difficulty,
      distractor_lexeme_ids: evidence.distractorLexemeIds,
      selected_lexeme_id: evidence.selectedLexemeId,
      typed_answer: evidence.typedAnswer,
      expected_answer: evidence.expectedAnswer,
      error_type: evidence.errorType,
      occurred_at: evidence.occurredAt,
      metadata: evidence.metadata ?? {},
    });
    if (error) {
      if (error.code === "23505") {
        throw new LearningDomainError(
          "DUPLICATE_TASK_EVIDENCE",
          `Task ${evidence.taskId} already has terminal evidence`,
        );
      }
      throw error;
    }
  }

  async saveStudentLexemeModel(model: StudentLexemeModel): Promise<void> {
    const { error: modelError } = await this.client
      .from("student_lexeme_models")
      .upsert({
        id: model.id,
        user_id: model.userId,
        lexeme_id: model.lexemeId,
        policy_version: model.policyVersion,
        mastery_stage: model.masteryStage,
        retention_state: model.retentionState,
        mastery_score: model.masteryScore,
        mastery_confidence: model.masteryConfidence,
        first_seen_at: model.firstSeenAt,
        last_seen_at: model.lastSeenAt,
        last_success_at: model.lastSuccessAt,
        last_failure_at: model.lastFailureAt,
        next_review_at: model.nextReviewAt,
        review_interval_days: model.reviewIntervalDays,
        evidence_count: model.evidenceCount,
        distinct_practice_days: model.distinctPracticeDays,
        distinct_task_types: model.distinctTaskTypes,
        created_at: model.createdAt,
        updated_at: model.updatedAt,
      });
    if (modelError) {
      throw modelError;
    }

    const skillRows = VOCABULARY_SKILLS.map((skill) => {
      const state = model.skills[skill];
      return {
        student_lexeme_model_id: model.id,
        skill,
        score: state.score,
        confidence: state.confidence,
        total_attempts: state.totalAttempts,
        correct_attempts: state.correctAttempts,
        incorrect_attempts: state.incorrectAttempts,
        assisted_attempts: state.assistedAttempts,
        consecutive_independent_successes: state.consecutiveIndependentSuccesses,
        last_practiced_at: state.lastPracticedAt,
        last_independent_success_at: state.lastIndependentSuccessAt,
        recent_performance: state.recentPerformance,
        updated_at: model.updatedAt,
      };
    });

    const { error: skillError } = await this.client
      .from("student_lexeme_skill_states")
      .upsert(skillRows, { onConflict: "student_lexeme_model_id,skill" });
    if (skillError) {
      throw skillError;
    }

    for (const weakness of model.weaknesses) {
      const { error: weaknessError } = await this.client
        .from("student_lexeme_weaknesses")
        .upsert({
          id: weakness.id,
          student_lexeme_model_id: model.id,
          type: weakness.type,
          skill: weakness.skill ?? null,
          severity: weakness.severity,
          related_lexeme_id: weakness.relatedLexemeId ?? null,
          reason: weakness.reason,
          detected_at: weakness.detectedAt,
          last_triggered_at: weakness.lastTriggeredAt,
          resolved_at: weakness.resolvedAt,
        });
      if (weaknessError) {
        throw weaknessError;
      }
    }
  }

  /**
   * Sequential write: evidence first, then snapshot. If the snapshot write
   * fails, evidence remains and can rebuild StudentLexemeModel. A future
   * Postgres RPC should wrap both writes.
   */
  async commitEvidenceAndSnapshot(
    evidence: LearningEvidence,
    model: StudentLexemeModel,
  ): Promise<void> {
    await this.appendEvidence(evidence);
    try {
      await this.saveStudentLexemeModel(model);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      throw new LearningDomainError(
        "SNAPSHOT_WRITE_FAILED",
        `Evidence ${evidence.id} was appended but the snapshot write failed (${detail}). Rebuild the StudentLexemeModel from the evidence log.`,
      );
    }
  }
}
