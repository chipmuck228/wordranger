/**
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Candidate is sense-level. Frozen Evidence is lexeme-level.
 * Compilation is allowed only when that projection is unambiguous.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import { DomainErrorCode } from "../domain/errors";
import type {
  LexemeSenseRef,
  ResolvedContextSnapshot,
  ResolvedTargetSnapshot,
} from "../domain/types";
import type { CompilationError } from "./types";

export interface SenseProjectionInput {
  expectedSense: LexemeSenseRef;
  resolvedTargets: readonly ResolvedTargetSnapshot[];
  resolvedContext: ResolvedContextSnapshot;
}

export interface SenseProjectionOk {
  target: ResolvedTargetSnapshot;
  frozenLexemeId: string;
}

export type SenseProjectionResult =
  | { ok: true; value: SenseProjectionOk }
  | { ok: false; error: CompilationError };

export function validateSenseProjection(
  input: SenseProjectionInput,
): SenseProjectionResult {
  const target = input.resolvedTargets.find((item) =>
    sameLexemeSense(item.sense, input.expectedSense),
  );
  if (!target) {
    return {
      ok: false,
      error: {
        code: DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH,
        message:
          "expectedResponse sense does not match any resolved target by lexemeId + senseId",
        path: "expectedResponse.sense",
      },
    };
  }

  const scopedSenses = collectScopedSenses(
    input.resolvedTargets,
    input.resolvedContext,
  );
  const siblingSenses = scopedSenses.filter(
    (sense) =>
      sense.lexemeId === input.expectedSense.lexemeId &&
      !sameLexemeSense(sense, input.expectedSense),
  );
  if (siblingSenses.length > 0) {
    return {
      ok: false,
      error: {
        code: DomainErrorCode.COMPILATION_AMBIGUOUS_SENSE_PROJECTION,
        message: `Frozen Evidence can only store lexemeId ${input.expectedSense.lexemeId}; multiple senses of that lexeme are in scope`,
        path: "resolvedTargets",
      },
    };
  }

  return {
    ok: true,
    value: {
      target,
      frozenLexemeId: input.expectedSense.lexemeId,
    },
  };
}

export function collectScopedSenses(
  resolvedTargets: readonly ResolvedTargetSnapshot[],
  resolvedContext: ResolvedContextSnapshot,
): LexemeSenseRef[] {
  const senses: LexemeSenseRef[] = resolvedTargets.map((item) => item.sense);
  for (const entity of resolvedContext.entityBindings) {
    for (const binding of entity.lexemeSenseBindings ?? []) {
      senses.push(binding.sense);
    }
  }
  for (const perspective of resolvedContext.perspectiveBindings ?? []) {
    senses.push(perspective.expressedSense);
  }
  return uniqueSenses(senses);
}

function uniqueSenses(senses: readonly LexemeSenseRef[]): LexemeSenseRef[] {
  const seen = new Set<string>();
  const unique: LexemeSenseRef[] = [];
  for (const sense of senses) {
    const key = `${sense.lexemeId}::${sense.senseId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(sense);
  }
  return unique;
}
