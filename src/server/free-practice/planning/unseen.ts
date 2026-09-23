import "server-only";

import { MasteryStage } from "@/domain/learning/mastery-stage";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import { hasUsableMeaning } from "./skill-content";
import type { FreePracticeLearnerSnapshot } from "./types";

export function isUnseenSnapshot(
  snapshot: FreePracticeLearnerSnapshot | undefined,
): boolean {
  return snapshot === undefined || snapshot.masteryStage === MasteryStage.UNSEEN;
}

export function selectUnseenEligible(
  lexemes: readonly Lexeme[],
  snapshots: readonly FreePracticeLearnerSnapshot[],
): Lexeme[] {
  const byLexeme = new Map(
    snapshots.map((snapshot) => [snapshot.lexemeId, snapshot]),
  );
  return lexemes
    .filter((lexeme) => {
      if (!hasUsableMeaning(lexeme)) {
        return false;
      }
      return isUnseenSnapshot(byLexeme.get(lexeme.id));
    })
    .sort((left, right) => {
      if (left.sourceIndex !== right.sourceIndex) {
        return left.sourceIndex - right.sourceIndex;
      }
      return (left.canonicalKey ?? left.id).localeCompare(
        right.canonicalKey ?? right.id,
      );
    });
}
