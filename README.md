# @aragornhq/clickhouse-migration

> ⚔️ Production-grade CLI for managing ClickHouse schema migrations with raw SQL, rollback, integrity tracking, strict mode, and GitHub automation.

---

## 🚀 Features

- ✅ Native [ClickHouse](https://clickhouse.com/) support using [`@clickhouse/client`](https://www.npmjs.com/package/@clickhouse/client)
- ✅ Fully typed CLI (TypeScript)
- ✅ Supports `migration:create`, `migration:up`, `migration:down`
- ✅ Rollback support using `-- ROLLBACK BELOW --` separator
- ✅ SHA-256 hash tracking for applied migrations
- ✅ Enforced one-statement-per-file (recommended)
- ✅ Optional config via `clickhouse-migration.json`

---

## 📦 Installation

```bash
npm install --save-dev @aragornhq/clickhouse-migration
```

## 🔧 Setup

1. Set the ClickHouse connection using environment variables:

```bash
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DB=default
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
# set to "true" when using HTTPS
CLICKHOUSE_USE_TLS=false
```

2. Specify where your migration files live via a `clickhouse-migration.json` file:

```json
{
  "path": "db/migrations"
}
```

Create the folder if it does not already exist.

## 🛠️ Usage

Run the CLI with `npx` or via an npm script. The executable name is `ch-migrate`:

```bash
npx ch-migrate <command> [options]
```

### Commands

- `migration:create <name> --path=<folder>` – create a timestamped migration file. The `--path` option is optional when the path is defined in `clickhouse-migration.json`.
- `migration:up --path=<folder>` – apply all pending migrations.
- `migration:down --file=<filename.sql> --path=<folder>` – roll back a single migration.

Each file should contain your SQL up statement followed by `-- ROLLBACK BELOW --` and the down statement. Only one SQL statement per section is enforced.

```sql
-- 20250101_create_table.sql
CREATE TABLE example (id UInt8) ENGINE = MergeTree;

-- ROLLBACK BELOW --
DROP TABLE example;
```

Applied migrations are recorded in a `migrations` table together with a SHA‑256 hash. If a hash changes, the run fails to prevent drift.

