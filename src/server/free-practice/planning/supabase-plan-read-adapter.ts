import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { FREE_PRACTICE_SNAPSHOT_PAGE_SIZE } from "./constants";
import type {
  FreePracticeLearnerSnapshot,
  FreePracticePlanReadPort,
  FreePracticeTerminalEvidence,
} from "./types";

interface SnapshotRow {
  lexeme_id: string;
  mastery_stage: string;
}

interface EvidenceRow {
  id: string;
  lexeme_id: string;
  skill: string;
  outcome: string;
  occurred_at: string;
}

function requireUserId(userId: string): string {
  const trimmed = typeof userId === "string" ? userId.trim() : "";
  if (!trimmed) {
    throw new Error("Free Practice read adapter requires a trusted userId");
  }
  return trimmed;
}

function parseMasteryStage(value: string): MasteryStage {
  if ((Object.values(MasteryStage) as string[]).includes(value)) {
    return value as MasteryStage;
  }
  throw new Error(`Unknown mastery_stage ${value}`);
}

function parseSkill(value: string): VocabularySkill {
  if ((Object.values(VocabularySkill) as string[]).includes(value)) {
    return value as VocabularySkill;
  }
  throw new Error(`Unknown skill ${value}`);
}

function parseOutcome(value: string): EvidenceOutcome {
  if ((Object.values(EvidenceOutcome) as string[]).includes(value)) {
    return value as EvidenceOutcome;
  }
  throw new Error(`Unknown outcome ${value}`);
}

/**
 * Dedicated Free Practice read adapter. Does not change the frozen
 * LearningRepository. Every query is bound to the caller-supplied
 * trusted userId; this class never reads another user's rows.
 *
 * The injected client may be service-role (current V1 server pattern)
 * or anon. Service role is not a license to omit the user_id filter.
 */
export class SupabaseFreePracticePlanReadAdapter
  implements FreePracticePlanReadPort
{
  constructor(private readonly client: SupabaseClient) {}

  async listStudentLexemeSnapshots(
    userId: string,
  ): Promise<FreePracticeLearnerSnapshot[]> {
    const trusted = requireUserId(userId);
    const pageSize = FREE_PRACTICE_SNAPSHOT_PAGE_SIZE;
    const rows: SnapshotRow[] = [];
    let from = 0;
    for (;;) {
      const to = from + pageSize - 1;
      const { data, error } = await this.client
        .from("student_lexeme_models")
        .select("lexeme_id, mastery_stage")
        .eq("user_id", trusted)
        .order("lexeme_id", { ascending: true })
        .range(from, to);
      if (error) {
        throw error;
      }
      const page = (data ?? []) as SnapshotRow[];
      rows.push(...page);
      if (page.length < pageSize) {
        break;
      }
      from += pageSize;
    }
    return rows.map((row) => ({
      lexemeId: row.lexeme_id,
      masteryStage: parseMasteryStage(row.mastery_stage),
    }));
  }

  async listRecentTerminalEvidence(
    userId: string,
    limit: number,
  ): Promise<FreePracticeTerminalEvidence[]> {
    const trusted = requireUserId(userId);
    const { data, error } = await this.client
      .from("learning_evidence")
      .select("id, lexeme_id, skill, outcome, occurred_at")
      .eq("user_id", trusted)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (error) {
      throw error;
    }
    return ((data ?? []) as EvidenceRow[]).map((row) => ({
      id: row.id,
      lexemeId: row.lexeme_id,
      skill: parseSkill(row.skill),
      outcome: parseOutcome(row.outcome),
      occurredAt: row.occurred_at,
    }));
  }
}
