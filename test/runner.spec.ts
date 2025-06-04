import fs from "fs";
import path from "path";
import { Runner } from "../src/runner";
import { clickhouse } from "../src/client";

jest.mock("../src/client", () => {
  const data: any[] = [];
  return {
    clickhouse: {
      query: jest.fn(({ query }: { query: string }) => {
        if (query.includes("SELECT")) {
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
  });

  afterAll(() => {
    const file = path.join(testMigrationsDir, "20250101_test.sql");
    fs.unlinkSync(file);
    fs.rmdirSync(testMigrationsDir);
  });

  it("applies migrations", async () => {
    await expect(runner.applyMigrations()).resolves.not.toThrow();
  });

  it("rolls back migration", async () => {
    await expect(
      runner.rollbackMigration("20250101_test.sql")
    ).resolves.not.toThrow();
  });
});
