#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';

const CONFIG_FILE = 'ch-migration.json';

const args = process.argv.slice(2);
const command = args[0];
const name = args[1];
const pathArg = args.find((arg) => arg.startsWith('--path='));
const fileArg = args.find((arg) => arg.startsWith('--file='));
const outArg = args.find((arg) => arg.startsWith('--out='));
const dryRun = args.includes('--dry-run');

const configPath = path.resolve(process.cwd(), CONFIG_FILE);
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : {};
const folderPath = pathArg?.split('=')[1] || config.path || '';

const ensureFolderPath = () => {
  if (!folderPath) {
    throw new Error(
      `--path=<folder> is required or must be defined in ${CONFIG_FILE}`,
    );
  }

  return folderPath;
};

const getRunner = async () => {
  const { Runner } = await import('./runner');
  return new Runner(ensureFolderPath());
};

(async () => {
  try {
    if (command === 'migration:create') {
      ensureFolderPath();
      if (!name) throw new Error('Missing migration name');
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14);
      const filename = `${timestamp}_${name}.sql`;
      const fullDir = path.resolve(folderPath);
      if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
      const filePath = path.join(fullDir, filename);
      fs.writeFileSync(
        filePath,
        `-- ${filename}\n-- SQL up\n\n-- ROLLBACK BELOW --\n-- SQL down\n`,
      );
      console.log(`Created migration: ${filePath}`);
    } else if (command === 'migration:up') {
      const runner = await getRunner();
      await runner.applyMigrations(dryRun);
    } else if (command === 'migration:down') {
      const filename = fileArg?.split('=')[1];
      if (!filename) throw new Error('--file=<filename> is required');
      const runner = await getRunner();
      await runner.rollbackMigration(filename);
    } else if (command === 'dump') {
      const outFile = outArg?.split('=')[1];
      if (!outFile) throw new Error('--out=<file> is required');
      const runner = await getRunner();
      await runner.dump(outFile);
    } else {
      console.log(
        'Usage:\n  migration:create <name> --path=./migrations\n  migration:up --path=./migrations [--dry-run]\n  migration:down --file=filename.sql --path=./migrations\n  dump --out=dump.sql',
      );
    }
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
})();
