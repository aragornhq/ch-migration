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

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("supports dry run", async () => {
    const dryFile = path.join(testMigrationsDir, "20250102_dry.sql");
    fs.writeFileSync(
      dryFile,
      `CREATE TABLE dry_run (id UInt8) ENGINE = Memory;\n-- ROLLBACK BELOW --\nDROP TABLE dry_run;`
    );

    await expect(runner.applyMigrations(true)).resolves.not.toThrow();
    expect(clickhouse.command).not.toHaveBeenCalled();
    expect(clickhouse.insert).not.toHaveBeenCalled();

    fs.unlinkSync(dryFile);
  });

  it("creates migrations table with replication when CH_CLUSTER is set", async () => {
    const dir = path.join(__dirname, "cluster");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const clusterRunner = new Runner(dir);
    process.env.CH_CLUSTER = "test_cluster";

    await expect(clusterRunner.applyMigrations()).resolves.not.toThrow();

    expect(clickhouse.command).toHaveBeenCalledWith({
      query: expect.stringContaining("ON CLUSTER test_cluster"),
    });
    expect(clickhouse.command).toHaveBeenCalledWith({
      query: expect.stringContaining("ReplicatedReplacingMergeTree"),
    });

    fs.rmdirSync(dir);
    delete process.env.CH_CLUSTER;
  });

  it("replaces ${CH_CLUSTER} before applying", async () => {
    const dir = path.join(__dirname, "cluster_replace");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const clusterRunner = new Runner(dir);

    process.env.CH_CLUSTER = "test_cluster";
    const clusterFile = path.join(dir, "20250103_cluster.sql");
    const raw =
      `CREATE DATABASE test ON CLUSTER ${"${CH_CLUSTER}"};\n` +
      `-- ROLLBACK BELOW --\n` +
      `DROP DATABASE test ON CLUSTER ${"${CH_CLUSTER}"};`;
    fs.writeFileSync(clusterFile, raw);

    const replaced = raw.replace(/\$\{CH_CLUSTER\}/g, "test_cluster");
    const expected = crypto.createHash("sha256").update(replaced).digest("hex");

    await expect(clusterRunner.applyMigrations()).resolves.not.toThrow();
    expect(clickhouse.command).toHaveBeenCalledWith({
      query: "CREATE DATABASE test ON CLUSTER test_cluster;",
    });
    expect(clickhouse.insert).toHaveBeenCalledWith({
      table: "migrations",
      values: [{ filename: "20250103_cluster.sql", hash: expected }],
      format: "JSONEachRow",
    });

    fs.unlinkSync(clusterFile);
    fs.rmdirSync(dir);
    delete process.env.CH_CLUSTER;
  });

  it("errors if CREATE TABLE lacks ON CLUSTER or Replicated engine", async () => {
    const dir = path.join(__dirname, "cluster_invalid");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const invalidRunner = new Runner(dir);
    const badFile = path.join(dir, "20250104_bad.sql");
    fs.writeFileSync(
      badFile,
      `CREATE TABLE bad (id UInt8) ENGINE = MergeTree;\n-- ROLLBACK BELOW --\nDROP TABLE bad;`
    );

    process.env.CH_CLUSTER = "test_cluster";
    await expect(invalidRunner.applyMigrations()).rejects.toThrow(
      /must use ON CLUSTER test_cluster and a Replicated engine/
    );
    expect(clickhouse.command).not.toHaveBeenCalled();

    fs.unlinkSync(badFile);
    fs.rmdirSync(dir);
    delete process.env.CH_CLUSTER;
  });
});
