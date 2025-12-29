import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

describe("CLI", () => {
  it("creates a migration file without requiring ClickHouse connection vars", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ch-migration-cli-"));
    const env = { ...process.env };

    delete env.CH_HOST;
    delete env.CH_USER;
    delete env.CH_DB;
    delete env.CH_PORT;
    delete env.CH_PASSWORD;
    delete env.CH_USE_TLS;

    try {
      const result = spawnSync(
        "npx",
        ["ts-node", "src/cli.ts", "migration:create", "cli_test", `--path=${tmpDir}`],
        { env, encoding: "utf-8" }
      );

      expect(result.status).toBe(0);
      expect(result.error).toBeUndefined();

      const files = fs.readdirSync(tmpDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/cli_test\.sql$/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
