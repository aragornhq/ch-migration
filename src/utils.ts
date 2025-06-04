import fs from "fs";
import path from "path";
import crypto from "crypto";
import { MigrationFile } from "./types";

export function getMigrationFiles(dir: string): MigrationFile[] {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .map((filename) => {
      const filePath = path.join(dir, filename);
      const raw = fs.readFileSync(filePath, "utf8");
      const [upSql, downSql] = raw.split(/--\s*ROLLBACK BELOW\s*/i);
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      return {
        filename,
        upSql: upSql.trim(),
        downSql: downSql?.trim(),
        hash,
      };
    });
}
