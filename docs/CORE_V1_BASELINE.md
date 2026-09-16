# Core V1 Baseline

Core V1 is frozen. Game integrations are consumers of this baseline.

Reviewed commit at freeze: `295991bf95c723f02f516389083216373ed8135f`

## Frozen responsibilities

| Area | Owns |
| --- | --- |
| Vocabulary Domain | Lexemes, production-approved relations, `VocabularyContentPolicy` |
| Learning Core | Evidence → `StudentLexemeModel` (`MasteryStage`, `RetentionState`, weaknesses) |
| Task Protocol | `LearningNeed` → `PublicLearningTask` + server `TaskAnswerKey` |
| TaskEvaluator | Semantic grading |
| Submission | `submitTaskAction` is the only production grading path |
| Need Generator | What pedagogical needs exist for this student |
| Scheduler | Which needs belong in this session (priority, quotas, diversity) |
| Feasibility | Lexeme-aware content capability, not Task Generator probing |
| Performance bulk reads | `listLexemes()` + `listRelations()` once per plan, O(L + R) capability map |

Do not casually change:

- `MasteryStage` / `RetentionState` / Weakness semantics
- `LearningEvidence` / `LearningNeed` semantics
- Scheduler priority or quotas
- Task types or TaskEvaluator rules
- `VocabularyContentPolicy`

## Consumer rule

Renderers may:

- display `PublicLearningTask`
- emit student action intent
- show `GameSubmissionFeedback`

Renderers may not:

- grade
- create `LearningEvidence`
- mutate `StudentLexemeModel`
- select the next lexeme
- keep a parallel weak-word list

If a renderer cannot consume a contract, document `CORE_INTEGRATION_BLOCKER` instead of silently changing Core.

Phase 05 (Ranger Trial) found no Core integration blocker.

Runtime persistence adapters (`SupabaseLearningRepository`, `SupabaseLearningTaskRepository`, `SupabaseRangerTrialSessionStore`, `game_sessions`) are outside frozen Core domain semantics. They must not change mastery, retention, weakness, evidence, need, scheduler, evaluator, or vocabulary-policy behavior.
