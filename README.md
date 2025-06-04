# @aragornhq/clickhouse-migration

> ⚔️ Production-grade CLI for managing ClickHouse schema migrations with raw SQL, rollback, integrity tracking, Jest tests, and release automation.

## Features

- Native ClickHouse support (including ON CLUSTER)
- TCP connection (not HTTP)
- Fully typed CLI (TypeScript)
- `migration:create`, `migration:up`, `migration:down`
- SHA-256 migration hash validation
- Rollback support using `-- ROLLBACK BELOW --`
- Config file support: `clickhouse-migration.json` (path only)
- GitHub Actions: CI + NPM publishing from release branches
- Jest test framework scaffold

## Usage

Create a migration:
```bash
npx @aragornhq/clickhouse-migration migration:create init_schema --path=db/migrations
```

Apply migrations:
```bash
npx @aragornhq/clickhouse-migration migration:up --path=db/migrations
```

Rollback specific migration:
```bash
npx @aragornhq/clickhouse-migration migration:down --file=20250603_init_schema.sql --path=db/migrations
```

Config file (`clickhouse-migration.json`):
```json
{
  "path": "db/migrations"
}
```

## License

MIT — Built by Aragorn AI.