import { createClient } from '@clickhouse/client';

const options = {
  host: process.env.CH_HOST,
  username: process.env.CH_USER,
  password: process.env.CH_PASSWORD || '',
  database: process.env.CH_DB,
  port: process.env.CH_PORT,
  useTls: process.env.CH_USE_TLS === 'true',
};

const protocol = options.useTls ? 'https' : 'http';

export const clickhouse = createClient({
  url: `${protocol}://${options.username}:${encodeURIComponent(
    options.password,
  )}@${options.host}:${options.port}`,
  database: options.database,
});
