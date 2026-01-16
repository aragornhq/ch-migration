import { getClickhouseClient } from './client';
import { getMigrationFiles } from './utils';
import fs from 'fs';

export class Runner {
  constructor(private readonly migrationsDir: string) {}

  private stripLeadingComments(statement: string) {
    let trimmed = statement.trimStart();
    while (trimmed.startsWith("--") || trimmed.startsWith("/*")) {
      if (trimmed.startsWith("--")) {
        const nextLine = trimmed.indexOf("\n");
        if (nextLine === -1) {
          return "";
        }
        trimmed = trimmed.slice(nextLine + 1).trimStart();
      } else {
        const endBlock = trimmed.indexOf("*/");
        if (endBlock === -1) {
          return "";
        }
        trimmed = trimmed.slice(endBlock + 2).trimStart();
      }
    }
    return trimmed;
  }

  private async ensureTable() {
    const clickhouse = getClickhouseClient();
    const cluster = process.env.CH_CLUSTER;
    if (cluster) {
      await clickhouse.command({
        query: `
          CREATE TABLE IF NOT EXISTS migrations ON CLUSTER ${cluster} (
            filename String,
            hash String,
            applied_at DateTime DEFAULT now()
          ) ENGINE = ReplicatedReplacingMergeTree(
            '/clickhouse/tables/{shard}/{database}/{table}',
            '{replica}'
          ) ORDER BY filename
        `,
      });
    } else {
      await clickhouse.command({
        query: `
          CREATE TABLE IF NOT EXISTS migrations (
            filename String,
            hash String,
            applied_at DateTime DEFAULT now()
          ) ENGINE = MergeTree ORDER BY filename
        `,
      });
    }
  }

  private async getApplied(): Promise<Map<string, string>> {
    const clickhouse = getClickhouseClient();
    const result = await clickhouse.query({
      query: 'SELECT filename, hash FROM migrations',
      format: 'JSONEachRow',
    });

    const rows = await result.json();
    return new Map(rows.map((r: any) => [r.filename, r.hash]));
  }

  async applyMigrations(dryRun = false) {
    const files = getMigrationFiles(this.migrationsDir);
    const cluster = process.env.CH_CLUSTER;
    if (cluster) {
      const invalid = files.find(
        (f) =>
          f.upSql.some((statement) => {
            const trimmed = this.stripLeadingComments(statement);
            return (
              /^\s*CREATE\s+TABLE/i.test(trimmed) &&
              (!new RegExp(`ON\\s+CLUSTER\\s+${cluster}`, "i").test(
                statement,
              ) ||
                !/ENGINE\s*=\s*Replicated/i.test(statement))
            );
          }),
      );
      if (invalid) {
        throw new Error(
          `❌ Migration ${invalid.filename} must use ON CLUSTER ${cluster} and a Replicated engine when CH_CLUSTER is set`,
        );
      }
    }
    if (!dryRun) {
      await this.ensureTable();
    }
    const applied = await this.getApplied().catch(() => new Map());
    const appliedThisRun: any[] = [];

    for (const file of files) {
      if (!applied.has(file.filename)) {
        try {
          console.log(
            dryRun
              ? `📝 [Dry Run] Would apply ${file.filename}...`
              : `🚀 Applying ${file.filename}...`,
          );

          if (!dryRun) {
            const clickhouse = getClickhouseClient();
            for (const statement of file.upSql) {
              await clickhouse.command({ query: statement });
            }

            await clickhouse.insert({
              table: 'migrations',
              values: [{ filename: file.filename, hash: file.hash }],
              format: 'JSONEachRow',
            });

            appliedThisRun.push(file);
          }
        } catch (err) {
          console.error(`❌ Error applying ${file.filename}, rolling back...`);

          if (!dryRun) {
            const clickhouse = getClickhouseClient();
            if (file.downSql?.length) {
              console.log(`↩️ Rolling back statements in ${file.filename}...`);
              for (const rollbackStatement of [...file.downSql].reverse()) {
                try {
                  await clickhouse.command({ query: rollbackStatement });
                } catch (e) {
                  console.warn(
                    `⚠️ Failed rollback statement for ${file.filename}`,
                  );
                }
              }
            }
            for (const rollback of appliedThisRun.reverse()) {
              if (rollback.downSql?.length) {
                try {
                  console.log(`↩️ Rolling back ${rollback.filename}...`);
                  for (const rollbackStatement of [
                    ...rollback.downSql,
                  ].reverse()) {
                    await clickhouse.command({ query: rollbackStatement });
                  }
                } catch (e) {
                  console.warn(`⚠️ Failed rollback for ${rollback.filename}`);
                }
              }
            }

            throw err;
          }
        }
      } else if (applied.get(file.filename) !== file.hash) {
        throw new Error(`❌ Hash mismatch: ${file.filename}`);
      }
    }

    console.log(
      dryRun
        ? '🔍 Dry run completed. No migrations were applied.'
        : '✅ All migrations applied successfully.',
    );
  }

  async rollbackMigration(filename: string) {
    const clickhouse = getClickhouseClient();
    await this.ensureTable();
    const files = getMigrationFiles(this.migrationsDir);
    const file = files.find((f) => f.filename === filename);

    if (!file) throw new Error(`Migration file not found: ${filename}`);
    if (!file.downSql) throw new Error(`No rollback SQL found in ${filename}`);

    console.log(`↩️ Rolling back ${filename}...`);
    for (const statement of [...file.downSql].reverse()) {
      await clickhouse.command({ query: statement });
    }

    await clickhouse.command({
      query: `ALTER TABLE migrations DELETE WHERE filename = '${filename}'`,
    });

    console.log(`✅ Rolled back ${filename}`);
  }

  async dump(outputFile: string) {
    const clickhouse = getClickhouseClient();
    const result = await clickhouse.query({
      query:
        "SELECT name, create_table_query FROM system.tables WHERE database = currentDatabase()",
      format: 'JSONEachRow',
    });
    const rows = await result.json();

    const statements = rows
      .filter((r: any) => r.name !== 'migrations')
      .map((r: any) => {
        let sql = r.create_table_query as string;
        sql = sql.replace(
          /^CREATE\s+TABLE/i,
          'CREATE TABLE IF NOT EXISTS',
        );
        sql = sql.replace(
          /^CREATE\s+VIEW/i,
          'CREATE VIEW IF NOT EXISTS',
        );
        sql = sql.replace(
          /^CREATE\s+MATERIALIZED\s+VIEW/i,
          'CREATE MATERIALIZED VIEW IF NOT EXISTS',
        );
        return sql.endsWith(';') ? sql : `${sql};`;
      });

    fs.writeFileSync(outputFile, statements.join('\n\n') + '\n');
    console.log(`📝 Dumped schema to ${outputFile}`);
  }
}
