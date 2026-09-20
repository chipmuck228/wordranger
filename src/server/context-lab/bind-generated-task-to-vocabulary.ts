import "server-only";

import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import { lexemeIdFromCanonicalKey } from "@/lib/canonical-id";
import { bundledVocabularyRepository } from "@/server/runtime/bundled-vocabulary";

/**
 * Meal Candidate fixtures use opaque IDs such as `lex-spoon`.
 * Frozen `learning_tasks.lexeme_id` is a UUID FK to `lexemes(id)`.
 * Bind only the known Meal BUILD typing target onto the bundled spoon lexeme.
 */
const MEAL_FIXTURE_LEXEME_BINDINGS = [
  {
    fixtureLexemeId: "lex-spoon",
    canonicalKey: "lex-1311-1",
    lemma: "spoon",
  },
] as const;

export function bindGeneratedTaskToVocabulary(
  task: GeneratedLearningTask,
): { ok: true; task: GeneratedLearningTask } | { ok: false; reason: "UNBOUND_LEXEME" } {
  const fixtureLexemeId = task.publicTask.lexemeId;
  const binding = MEAL_FIXTURE_LEXEME_BINDINGS.find(
    (item) => item.fixtureLexemeId === fixtureLexemeId,
  );
  if (!binding) {
    if (isUuid(fixtureLexemeId)) {
      return { ok: true, task };
    }
    return { ok: false, reason: "UNBOUND_LEXEME" };
  }

  const lexeme = bundledVocabularyRepository().getLexemeByCanonicalKey(
    binding.canonicalKey,
  );
  if (!lexeme || lexeme.lemma !== binding.lemma) {
    return { ok: false, reason: "UNBOUND_LEXEME" };
  }
  if (lexeme.id !== lexemeIdFromCanonicalKey(binding.canonicalKey)) {
    return { ok: false, reason: "UNBOUND_LEXEME" };
  }

  return {
    ok: true,
    task: {
      publicTask: {
        ...task.publicTask,
        lexemeId: lexeme.id,
      },
      answerKey: {
        ...task.answerKey,
        targetLexemeId: lexeme.id,
      },
      generationTrace: {
        ...task.generationTrace,
        targetLexemeId: lexeme.id,
        candidateLexemeIds: [lexeme.id],
      },
    },
  };
}

export function contextLabBoundLexemeId(fixtureLexemeId: string): string | null {
  const binding = MEAL_FIXTURE_LEXEME_BINDINGS.find(
    (item) => item.fixtureLexemeId === fixtureLexemeId,
  );
  if (!binding) {
    return isUuid(fixtureLexemeId) ? fixtureLexemeId : null;
  }
  const lexeme = bundledVocabularyRepository().getLexemeByCanonicalKey(
    binding.canonicalKey,
  );
  return lexeme?.lemma === binding.lemma ? lexeme.id : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
