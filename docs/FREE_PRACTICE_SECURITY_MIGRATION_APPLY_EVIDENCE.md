# Free Practice Security Migration Apply Evidence

Candidate / not a Standard. This file records an authorized production
apply and post-apply runtime verification. It does not enable
`/practice` or change Homepage.

- Apply date: **2026-09-26** (Asia/Shanghai)
- Operator role: project database admin (Dashboard apply) and
  repository audit operator (read-only verification)
- Production identity: **PROJECT_MATCH**
- Migration path:
  `supabase/migrations_archive/pre_dedicated_baseline/202609250001_learner_table_server_only_access.sql`
- Migration SHA-256:
  `b6c348f538da8185aac45d06dbf03f1cdbd2e567844bc64e2db2ec5e8c0e7210`
- Dashboard result: **Success. No rows returned**
- Temporary env files: **TEMP_DELETED**

Do not copy the migration SQL here. Do not treat this note as
`db push` authorization.

## Post-apply six-table catalog

All relations below are `public.<name>`. Owner `postgres`.

| Table | RLS | FORCE | policies | PUBLIC / anon / authenticated | service_role DML |
| --- | --- | --- | --- | --- | --- |
| `public.learning_tasks` | on | off | 0 | none | SELECT / INSERT / UPDATE / DELETE |
| `public.game_sessions` | on | off | 0 | none | SELECT / INSERT / UPDATE / DELETE |
| `public.learning_evidence` | on | off | 0 | none | SELECT / INSERT / UPDATE / DELETE |
| `public.student_lexeme_models` | on | off | 0 | none | SELECT / INSERT / UPDATE / DELETE |
| `public.student_lexeme_skill_states` | on | off | 0 | none | SELECT / INSERT / UPDATE / DELETE |
| `public.student_lexeme_weaknesses` | on | off | 0 | none | SELECT / INSERT / UPDATE / DELETE |

Unchanged after apply: uuid primary keys, no sequences, the
server-only evaluation column remains jsonb not null, append-only
evidence trigger still present, no client views on these six tables.

## Anon zero-data deny probes

Production public URL and anon key were used only in an ephemeral
process. Values were not printed or saved.

Each table: GET `select=id` `limit=0`. No count. No learner id. No
server-only evaluation column. No writes.

| Table | Status class | Result | Body empty |
| --- | --- | --- | --- |
| `learning_tasks` | 4xx | DENIED | no |
| `game_sessions` | 4xx | DENIED | no |
| `learning_evidence` | 4xx | DENIED | no |
| `student_lexeme_models` | 4xx | DENIED | no |
| `student_lexeme_skill_states` | 4xx | DENIED | no |
| `student_lexeme_weaknesses` | 4xx | DENIED | no |

No learner rows were returned. Response bodies were not recorded.

## Controlled `/train` smoke

Official production `/train` path. One repository Daily Training V1
contract identity. No new identity mechanism. No placeholder
substitution for Free Practice.

| Check | Result |
| --- | --- |
| Session created | yes; session count +1 |
| Task created | yes; task count +1 |
| Evidence before → after first submit | 185 → 186 |
| Duplicate after refresh | still 186 |
| RLS / permission failure | none |

Submit used the normal UI StudentAction and existing
`submitTaskAction` / EvidenceFactory path. The public/browser payload
did not include the server-only evaluation column.

## Ownership / isolation

An official `/train` resume with a deliberately unrelated opaque
session association returned the existing generic `SESSION_NOT_FOUND`
result. No server-only evaluation payload appeared. Isolation did not
add Evidence (count remained 186). No foreign learner records were
fetched.

## Still closed / still forbidden

- `supabase_migrations.schema_migrations` remains absent
- Management API migration list remains empty
- `db push`, `migration up`, and history repair remain **forbidden**
- `/practice` remains disabled (production 404; flags unset)
- Homepage Free Practice messaging still links to `/train`
- Context Lab and frozen learning semantics were not changed
- Vercel variables were not added, removed, or edited
