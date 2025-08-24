# @aragornhq/ch-migration

> ⚔️ Production-grade CLI for managing ClickHouse schema migrations with raw SQL, rollback, integrity tracking, strict mode, and GitHub automation.

---

## 🚀 Features

- ✅ Native [ClickHouse](https://clickhouse.com/) support using [`@clickhouse/client`](https://www.npmjs.com/package/@clickhouse/client)
- ✅ Fully typed CLI (TypeScript)
- ✅ Supports `migration:create`, `migration:up`, `migration:down`, `dump`
- ✅ Optional dry run to validate migrations without applying them
- ✅ Rollback support using `-- ROLLBACK BELOW --` separator
- ✅ SHA-256 hash tracking for applied migrations
- ✅ Enforced one-statement-per-file (recommended)
- ✅ Optional config via `ch-migration.json`
- ✅ `${CH_CLUSTER}` placeholder replaced with the `CH_CLUSTER` environment variable

---

## 📦 Installation

```bash
npm install --save-dev @aragornhq/ch-migration
```

## 🔧 Setup

1. Set the ClickHouse connection using environment variables (prefixed with `CH_`):

```bash
CH_HOST=localhost
CH_PORT=8123
CH_DB=default
CH_USER=default
CH_PASSWORD=
# set to "true" when using HTTPS
CH_USE_TLS=false
# optional: set cluster name for `${CH_CLUSTER}`
CH_CLUSTER=
```

2. Specify where your migration files live via a `ch-migration.json` file:

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

- `migration:create <name> --path=<folder>` – create a timestamped migration file. The `--path` option is optional when the path is defined in `ch-migration.json`.
- `migration:up --path=<folder> [--dry-run]` – apply all pending migrations. Use `--dry-run` to preview without applying.
- `migration:down --file=<filename.sql> --path=<folder>` – roll back a single migration.
- `dump --out=<file>` – export `CREATE` statements for all tables in the current database. Each statement includes `IF NOT EXISTS` and no `DROP` statements so rerunning is safe.

Each file should contain your SQL up statement followed by `-- ROLLBACK BELOW --` and the down statement. Only one SQL statement per section is enforced.

```sql
-- 20250101_create_table.sql
CREATE TABLE example (id UInt8) ENGINE = MergeTree;

-- ROLLBACK BELOW --
DROP TABLE example;
```

Applied migrations are recorded in a `migrations` table together with a SHA‑256 hash. If a hash changes, the run fails to prevent drift.

