import "server-only";

import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";
import { FREE_PRACTICE_RECENT_TERMINAL_EVIDENCE_LIMIT } from "./constants";
import {
  canGenerateFreePracticeSkill,
  indexApprovedRelationsByLexeme,
} from "./skill-content";
import type { FreePracticeTerminalEvidence } from "./types";

export interface RecentlyIncorrectSelection {
  lexemeId: string;
  targetSkill: VocabularySkill;
  occurredAt: string;
  evidenceId: string;
}

export function compareTerminalEvidenceDesc(
  left: FreePracticeTerminalEvidence,
  right: FreePracticeTerminalEvidence,
): number {
  const time = right.occurredAt.localeCompare(left.occurredAt);
  if (time !== 0) {
    return time;
  }
  return right.id.localeCompare(left.id);
}

export function takeRecentTerminalWindow(
  evidence: readonly FreePracticeTerminalEvidence[],
  limit = FREE_PRACTICE_RECENT_TERMINAL_EVIDENCE_LIMIT,
): FreePracticeTerminalEvidence[] {
  return [...evidence].sort(compareTerminalEvidenceDesc).slice(0, limit);
}

function skillKey(lexemeId: string, skill: VocabularySkill): string {
  return `${lexemeId}::${skill}`;
}

/**
 * Latest-terminal-per-skill read model (Candidate §5.4).
 * Does not read Weakness, construct LearningNeed, or call the Scheduler.
 */
export function selectRecentlyIncorrectEligible(
  lexemes: readonly Lexeme[],
  relations: readonly LexemeRelation[],
  evidence: readonly FreePracticeTerminalEvidence[],
): RecentlyIncorrectSelection[] {
  const vocabulary = new Map(lexemes.map((lexeme) => [lexeme.id, lexeme]));
  const relationsByLexeme = indexApprovedRelationsByLexeme(relations);
  const window = takeRecentTerminalWindow(evidence);

  const latestByKey = new Map<string, FreePracticeTerminalEvidence>();
  for (const row of window) {
    const key = skillKey(row.lexemeId, row.skill);
    if (!latestByKey.has(key)) {
      latestByKey.set(key, row);
    }
  }

  const unresolved: RecentlyIncorrectSelection[] = [];
  for (const row of latestByKey.values()) {
    if (row.outcome !== EvidenceOutcome.INCORRECT) {
      continue;
    }
    const lexeme = vocabulary.get(row.lexemeId);
    if (!lexeme) {
      continue;
    }
    const hasApprovedRelation =
      (relationsByLexeme.get(row.lexemeId) ?? []).length > 0;
    if (!canGenerateFreePracticeSkill(lexeme, row.skill, hasApprovedRelation)) {
      continue;
    }
    unresolved.push({
      lexemeId: row.lexemeId,
      targetSkill: row.skill,
      occurredAt: row.occurredAt,
      evidenceId: row.id,
    });
  }

  const newestByLexeme = new Map<string, RecentlyIncorrectSelection>();
  for (const item of unresolved) {
    const existing = newestByLexeme.get(item.lexemeId);
    if (!existing) {
      newestByLexeme.set(item.lexemeId, item);
      continue;
    }
    const newer = compareTerminalEvidenceDesc(
      { id: item.evidenceId, occurredAt: item.occurredAt } as FreePracticeTerminalEvidence,
      {
        id: existing.evidenceId,
        occurredAt: existing.occurredAt,
      } as FreePracticeTerminalEvidence,
    );
    if (newer < 0) {
      newestByLexeme.set(item.lexemeId, item);
    }
  }

  return [...newestByLexeme.values()].sort((left, right) => {
    const time = right.occurredAt.localeCompare(left.occurredAt);
    if (time !== 0) {
      return time;
    }
    return left.lexemeId.localeCompare(right.lexemeId);
  });
}
