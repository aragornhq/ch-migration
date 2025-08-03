import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Runner } from "../src/runner";
import { clickhouse } from "../src/client";

jest.mock("../src/client", () => {
  const data: any[] = [];
  return {
    clickhouse: {
      query: jest.fn(({ query }: { query: string }) => {
        if (query.includes("system.tables")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve([
                {
                  name: "dump_table",
                  create_table_query:
                    "CREATE TABLE dump_table (id UInt8) ENGINE = Memory",
                },
              ]),
          });
        } else if (query.includes("FROM migrations")) {
          return Promise.resolve({
            json: () => Promise.resolve([...data]),
          });
        } else if (query.includes("CREATE TABLE")) {
          return Promise.resolve();
        } else if (query.includes("ALTER TABLE")) {
          const match = query.match(/filename = '(.+)'/);
          const name = match ? match[1] : "";
          const index = data.findIndex((d) => d.filename === name);
          if (index >= 0) data.splice(index, 1);
          return Promise.resolve();
        } else {
          return Promise.resolve();
        }
      }),
      command: jest.fn(({ query }: { query: string }) => Promise.resolve()),
      insert: jest.fn(({ values }: any) => {
        data.push(...values);
        return Promise.resolve();
      }),
    },
  };
});

describe("Migration Runner", () => {
  const testMigrationsDir = path.join(__dirname, "fixtures");
  const runner = new Runner(testMigrationsDir);
  let expectedHash = "";

  beforeAll(() => {
    if (!fs.existsSync(testMigrationsDir)) {
      fs.mkdirSync(testMigrationsDir);
    }

    const file = path.join(testMigrationsDir, "20250101_test.sql");
    fs.writeFileSync(
      file,
      `CREATE TABLE IF NOT EXISTS test_table (id UInt8) ENGINE = Memory;
        -- ROLLBACK BELOW --
        DROP TABLE IF EXISTS test_table;`
    );

    const raw = fs.readFileSync(file, "utf8");
    expectedHash = crypto.createHash("sha256").update(raw).digest("hex");
  });

  afterAll(() => {
    const file = path.join(testMigrationsDir, "20250101_test.sql");
    fs.unlinkSync(file);
    fs.rmdirSync(testMigrationsDir);
  });

  it("applies migrations", async () => {
    await expect(runner.applyMigrations()).resolves.not.toThrow();
    expect(clickhouse.insert).toHaveBeenCalledWith({
      table: "migrations",
      values: [{ filename: "20250101_test.sql", hash: expectedHash }],
      format: "JSONEachRow",
    });
  });

  it("rolls back migration", async () => {
    await expect(
      runner.rollbackMigration("20250101_test.sql")
    ).resolves.not.toThrow();
    expect(clickhouse.command).toHaveBeenCalledWith({
      query: "ALTER TABLE migrations DELETE WHERE filename = '20250101_test.sql'",
    });
  });

  it("dumps schema", async () => {
    const dumpFile = path.join(testMigrationsDir, "dump.sql");
    await expect(runner.dump(dumpFile)).resolves.not.toThrow();
    const content = fs.readFileSync(dumpFile, "utf8");
    expect(content).toContain("CREATE TABLE IF NOT EXISTS dump_table");
    expect(content).not.toMatch(/DROP/i);
    fs.unlinkSync(dumpFile);
  });
});
