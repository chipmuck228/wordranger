# WordRanger

Game-based vocabulary learning engine for junior-high English. Student games: Ranger Trial, Word Bubble, Matching, and Snake.

## Scripts

```bash
npm install
npm run dev
npm test
npm run test:progress
npm run lint
npm run import:vocabulary -- --dry-run
npm run generate:provisional-placement
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` for local development. The file is split into **Production** (Vercel + Supabase) and **Development** (local flags).

Vercel Production needs only:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Leave every Candidate / memory / write-gate flag unset on Vercel. Homepage 自由练习 goes to `/train` and does not link Context Lab. `npm run dev` uses `.env.local`. The **code default is durable Supabase**. In-memory fixtures are opt-in via `RANGER_TRIAL_RUNTIME=memory` (legacy name; also `GAME_RUNTIME=memory`). Playwright sets the memory fixture itself.

`npm test` does not write to Supabase. The live Daily Training persistence check is opt-in:

```bash
ALLOW_SUPABASE_PROGRESS_WRITES=1 npm run test:progress
```

That requires both `RUN_SUPABASE_PROGRESS=1` (set by the script) and `ALLOW_SUPABASE_PROGRESS_WRITES=1`. Without the write flag, the suite refuses to mutate whichever project is in `.env.local`. Apply `supabase/migrations/202609170004_cleanup_progress_test_user.sql` so leftover test evidence can be removed; the RPC still refuses the placeholder student user.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Learning Core](docs/LEARNING_CORE.md)
- [Learning Task Protocol](docs/LEARNING_TASK_PROTOCOL.md)
- [Database](docs/DATABASE.md)
- [Decisions](docs/DECISIONS.md)
