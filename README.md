# @aragornhq/clickhouse-migration

> ⚔️ Production-grade CLI for managing ClickHouse schema migrations using raw SQL. Includes rollback support, SHA-256 hash integrity, type-safe CLI, Jest tests, and GitHub Actions automation.

## 🚀 Features

- ✅ Native ClickHouse HTTP support via [`@clickhouse/client`](https://www.npmjs.com/package/@clickhouse/client)
- ⚙️ Uses ClickHouse's HTTP interface (not TCP)
- 📁 SQL file-based migrations
- ✍️ `migration:create`, `migration:up`, `migration:down` commands
- 🔒 SHA-256 hash tracking to ensure file integrity
- 🧨 Rollback support using `-- ROLLBACK BELOW --`
- 📦 `clickhouse-migration.json` for path config (no secrets stored)
- ✅ Fully typed CLI (TypeScript)
- 🧪 Jest test scaffold included
- 🔄 GitHub Actions for CI + NPM publishing from release branches
- 🖼 Cool CLI banner with Aragorn branding

---

## 📦 Installation

```bash
npm install --save-dev @aragornhq/clickhouse-migration
```
