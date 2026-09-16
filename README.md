# WordRanger

Game-based vocabulary learning engine for junior-high English. This repository currently contains the **Vocabulary Domain** plus the shared **Learning Core**: source/lexeme/graph types, policy v1, engine, persistence ports, import tooling, and Debug Labs.

## Scripts

```bash
npm install
npm run dev
npm test
npm run lint
npm run import:vocabulary -- --dry-run
```

Open [http://localhost:3000](http://localhost:3000), then **Open Vocabulary Debug Lab** or **Open Learning Core Debug Lab**.

Debug Labs use in-memory repositories loaded from `data/vocabulary`. Supabase env vars are optional.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Learning Core](docs/LEARNING_CORE.md)
- [Database](docs/DATABASE.md)
- [Decisions](docs/DECISIONS.md)
