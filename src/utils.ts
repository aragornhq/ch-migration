import fs from "fs";
import path from "path";
import crypto from "crypto";
import { MigrationFile } from "./types";

export function getMigrationFiles(dir: string): MigrationFile[] {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const filePath = path.join(dir, filename);
      const raw = fs.readFileSync(filePath, "utf8");

      // Replace cluster variable if present
      const cluster = process.env.CH_CLUSTER;
      let processed = raw;
      if (raw.includes("${CH_CLUSTER}")) {
        if (!cluster) {
          throw new Error("Environment variable CH_CLUSTER is not set");
        }
        processed = raw.replace(/\$\{CH_CLUSTER\}/g, cluster);
      }

      const [upSql, downSql] = processed.split(/--\s*ROLLBACK BELOW\s*/i);
      const hash = crypto
        .createHash("sha256")
        .update(processed)
        .digest("hex");
      return {
        filename,
        upSql: upSql.trim(),
        downSql: downSql?.trim(),
        hash,
      };
    });
}
