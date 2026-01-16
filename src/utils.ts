import fs from "fs";
import path from "path";
import crypto from "crypto";
import { MigrationFile } from "./types";

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += char;
      if (char === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingle) {
      current += char;
      if (char === "'" && sql[i - 1] !== "\\") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      current += char;
      if (char === '"' && sql[i - 1] !== "\\") {
        inDouble = false;
      }
      continue;
    }

    if (inBacktick) {
      current += char;
      if (char === "`") {
        inBacktick = false;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      inLineComment = true;
      current += char + next;
      i += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      current += char + next;
      i += 1;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      current += char;
      continue;
    }

    if (char === "`") {
      inBacktick = true;
      current += char;
      continue;
    }

    if (char === ";") {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}

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

      const [upSql, downSql] = processed.split(
        /--\s*ROLLBACK BELOW\s*--\s*/i,
      );
      const hash = crypto
        .createHash("sha256")
        .update(processed)
        .digest("hex");
      return {
        filename,
        upSql: splitSqlStatements(upSql),
        downSql: downSql ? splitSqlStatements(downSql) : undefined,
        hash,
      };
    });
}
