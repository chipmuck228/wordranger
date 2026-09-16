# WordRanger

Game-based vocabulary learning engine for junior-high English. This repository currently contains the shared **Learning Core** only: domain model, policy v1, engine, persistence ports, and a Debug Lab.

## Scripts

```bash
npm install
npm run dev
npm test
npm run lint
```

Open [http://localhost:3000](http://localhost:3000), then **Open Learning Core Debug Lab**.

The Debug Lab uses an in-memory repository. Supabase env vars are optional.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Learning Core](docs/LEARNING_CORE.md)
- [Database](docs/DATABASE.md)
- [Decisions](docs/DECISIONS.md)
