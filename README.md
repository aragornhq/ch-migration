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
