-- Evidence.session_id is a correlation token (game_sessions.id or debug session).
-- After Phase 05, student games persist orchestration in game_sessions, not
-- learning_sessions. The Core FK blocked submitTaskAction from writing Evidence.

alter table learning_evidence
  drop constraint if exists learning_evidence_session_id_fkey;

comment on column learning_evidence.session_id is
  'Optional session correlation. Game renderers use game_sessions.id. Not a learning-sessions ownership FK.';
