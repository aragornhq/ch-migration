import { clickhouse } from './client';
import { getMigrationFiles } from './utils';

export class Runner {
  constructor(private readonly migrationsDir: string) {}

  private async ensureTable() {
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

  private async getApplied(): Promise<Map<string, string>> {
    const result = await clickhouse.query({
      query: 'SELECT filename, hash FROM migrations',
      format: 'JSONEachRow',
    });

    const rows = await result.json();
    return new Map(rows.map((r: any) => [r.filename, r.hash]));
  }

  async applyMigrations() {
    await this.ensureTable();
    const applied = await this.getApplied();
    const files = getMigrationFiles(this.migrationsDir);
    const appliedThisRun: any[] = [];

    for (const file of files) {
      if (!applied.has(file.filename)) {
        try {
          console.log(`🚀 Applying ${file.filename}...`);

          // OPTIONAL: enforce 1 SQL statement per file
          if ((file.upSql.match(/;/g) || []).length > 1) {
            throw new Error(
              `❌ Migration ${file.filename} may contain multiple SQL statements. Use 1 per file.`,
            );
          }

          await clickhouse.command({ query: file.upSql });

          await clickhouse.insert({
            table: 'migrations',
            values: [{ filename: file.filename, hash: file.hash }],
            format: 'JSONEachRow',
          });

          appliedThisRun.push(file);
        } catch (err) {
          console.error(`❌ Error applying ${file.filename}, rolling back...`);

          for (const rollback of appliedThisRun.reverse()) {
            if (rollback.downSql) {
              try {
                console.log(`↩️ Rolling back ${rollback.filename}...`);
                await clickhouse.command({ query: rollback.downSql });
              } catch (e) {
                console.warn(`⚠️ Failed rollback for ${rollback.filename}`);
              }
            }
          }

          throw err;
        }
      } else if (applied.get(file.filename) !== file.hash) {
        throw new Error(`❌ Hash mismatch: ${file.filename}`);
      }
    }

    console.log('✅ All migrations applied successfully.');
  }

  async rollbackMigration(filename: string) {
    await this.ensureTable();
    const files = getMigrationFiles(this.migrationsDir);
    const file = files.find((f) => f.filename === filename);

    if (!file) throw new Error(`Migration file not found: ${filename}`);
    if (!file.downSql) throw new Error(`No rollback SQL found in ${filename}`);

    console.log(`↩️ Rolling back ${filename}...`);
    await clickhouse.command({ query: file.downSql });

    await clickhouse.command({
      query: `ALTER TABLE migrations DELETE WHERE filename = '${filename}'`,
    });

    console.log(`✅ Rolled back ${filename}`);
  }
}
