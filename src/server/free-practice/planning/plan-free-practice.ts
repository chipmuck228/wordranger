import "server-only";

import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import {
  FREE_PRACTICE_RECENT_TERMINAL_EVIDENCE_LIMIT,
  FREE_PRACTICE_REQUESTED_COUNTS,
} from "./constants";
import { selectRecentlyIncorrectEligible } from "./recently-incorrect";
import type {
  FreePracticeItem,
  FreePracticePlanReadPort,
  FreePracticePlanResult,
  FreePracticeRequest,
  FreePracticeRequestedCount,
  FreePracticeSource,
  FreePracticeVocabularyRead,
} from "./types";
import { selectUnseenEligible } from "./unseen";

export interface PlanFreePracticeInput {
  /**
   * Server-internal learner id. Future public callers must pass the
   * value from `requireFreePracticeIdentity`. Never read from a
   * browser payload.
   */
  userId: string;
  request: FreePracticeRequest;
  vocabulary: FreePracticeVocabularyRead;
  read: FreePracticePlanReadPort;
  createId: () => string;
}

const ALLOWED_COUNTS = new Set<number>(FREE_PRACTICE_REQUESTED_COUNTS);
const ALLOWED_SOURCES = new Set<FreePracticeSource>([
  "UNSEEN",
  "RECENTLY_INCORRECT",
]);

function isRequestedCount(value: unknown): value is FreePracticeRequestedCount {
  return typeof value === "number" && ALLOWED_COUNTS.has(value);
}

function isSource(value: unknown): value is FreePracticeSource {
  return typeof value === "string" && ALLOWED_SOURCES.has(value as FreePracticeSource);
}

function trustedUserId(userId: string): string | null {
  if (typeof userId !== "string") {
    return null;
  }
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toResult(
  source: FreePracticeSource,
  requestedCount: number,
  items: FreePracticeItem[],
): FreePracticePlanResult {
  const plannedCount = items.length;
  if (plannedCount === 0) {
    return {
      status: "EMPTY",
      source,
      requestedCount,
      plannedCount: 0,
      items: [],
      reason: "NO_ELIGIBLE_WORDS",
    };
  }
  if (plannedCount === requestedCount) {
    return {
      status: "READY",
      source,
      requestedCount,
      plannedCount,
      items,
    };
  }
  return {
    status: "PARTIAL",
    source,
    requestedCount,
    plannedCount,
    items,
    reason: "INSUFFICIENT_ELIGIBLE_WORDS",
  };
}

/**
 * Pure application planner: FreePracticeRequest → eligible pool →
 * FreePracticePlanResult. Does not persist, does not call the
 * Scheduler, and does not write learner state.
 */
export async function planFreePractice(
  input: PlanFreePracticeInput,
): Promise<FreePracticePlanResult> {
  const userId = trustedUserId(input.userId);
  if (!userId) {
    return { status: "REJECTED", reason: "INVALID_USER" };
  }
  if (!isSource(input.request?.source)) {
    return { status: "REJECTED", reason: "INVALID_SOURCE" };
  }
  if (!isRequestedCount(input.request?.requestedCount)) {
    return { status: "REJECTED", reason: "INVALID_REQUESTED_COUNT" };
  }

  const source = input.request.source;
  const requestedCount = input.request.requestedCount;

  if (source === "UNSEEN") {
    const [lexemes, snapshots] = await Promise.all([
      input.vocabulary.listLexemes(),
      input.read.listStudentLexemeSnapshots(userId),
    ]);
    const eligible = selectUnseenEligible(lexemes, snapshots).slice(
      0,
      requestedCount,
    );
    const items = eligible.map((lexeme) => ({
      id: input.createId(),
      lexemeId: lexeme.id,
      targetSkill: VocabularySkill.MEANING_RECOGNITION,
      source,
    }));
    return toResult(source, requestedCount, items);
  }

  const [lexemes, relations, evidence] = await Promise.all([
    input.vocabulary.listLexemes(),
    input.vocabulary.listRelations(),
    input.read.listRecentTerminalEvidence(
      userId,
      FREE_PRACTICE_RECENT_TERMINAL_EVIDENCE_LIMIT,
    ),
  ]);
  const eligible = selectRecentlyIncorrectEligible(
    lexemes,
    relations,
    evidence,
  ).slice(0, requestedCount);
  const items = eligible.map((row) => ({
    id: input.createId(),
    lexemeId: row.lexemeId,
    targetSkill: row.targetSkill,
    source,
  }));
  return toResult(source, requestedCount, items);
}
