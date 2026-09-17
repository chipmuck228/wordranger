# WordRanger

Game-based vocabulary learning engine for junior-high English. Student games: Ranger Trial, Word Bubble, Matching, and Snake.

## Scripts

```bash
npm install
npm run dev
npm test
npm run lint
npm run import:vocabulary -- --dry-run
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev` uses whatever is in `.env.local`. The **code default is durable Supabase**. In-memory fixtures are opt-in via `RANGER_TRIAL_RUNTIME=memory` (legacy name; also `GAME_RUNTIME=memory`). Playwright sets the memory fixture itself. Production must leave both unset.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Learning Core](docs/LEARNING_CORE.md)
- [Learning Task Protocol](docs/LEARNING_TASK_PROTOCOL.md)
- [Database](docs/DATABASE.md)
- [Decisions](docs/DECISIONS.md)
