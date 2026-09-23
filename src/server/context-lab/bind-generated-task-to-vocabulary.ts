import "server-only";

import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import { lexemeIdFromCanonicalKey } from "@/lib/canonical-id";
import {
  findBundledLexemeBinding,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { bundledVocabularyRepository } from "@/server/runtime/bundled-vocabulary";

/**
 * Bind a Candidate fixture lexeme onto bundled vocabulary.
 * Identity is canonicalKey + live vocabulary lookup. Lemma is never identity.
 */
export function bindGeneratedTaskToVocabulary(
  task: GeneratedLearningTask,
): { ok: true; task: GeneratedLearningTask } | { ok: false; reason: "UNBOUND_LEXEME" } {
  const fixtureLexemeId = task.publicTask.lexemeId;
  const resolved = resolveContextualLexemeId(fixtureLexemeId);
  if (!resolved) {
    return { ok: false, reason: "UNBOUND_LEXEME" };
  }
  if (resolved === fixtureLexemeId) {
    return { ok: true, task };
  }

  return {
    ok: true,
    task: {
      publicTask: {
        ...task.publicTask,
        lexemeId: resolved,
      },
      answerKey: {
        ...task.answerKey,
        targetLexemeId: resolved,
      },
      generationTrace: {
        ...task.generationTrace,
        targetLexemeId: resolved,
        candidateLexemeIds: [resolved],
      },
    },
  };
}

export function contextLabBoundLexemeId(fixtureLexemeId: string): string | null {
  return resolveContextualLexemeId(fixtureLexemeId);
}

export function resolveContextualLexemeId(fixtureOrUuid: string): string | null {
  const binding = findBundledLexemeBinding(fixtureOrUuid);
  if (!binding) {
    return isUuid(fixtureOrUuid) ? fixtureOrUuid : null;
  }
  const expectedId = bundledBindingLexemeId(binding);
  const lexeme = bundledVocabularyRepository().getLexemeByCanonicalKey(
    binding.canonicalKey,
  );
  if (!lexeme || lexeme.id !== expectedId) {
    return null;
  }
  if (lexeme.id !== lexemeIdFromCanonicalKey(binding.canonicalKey)) {
    return null;
  }
  if (lexeme.lemma !== binding.lemma) {
    return null;
  }
  return lexeme.id;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
