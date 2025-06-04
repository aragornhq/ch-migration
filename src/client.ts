import { createClient } from '@clickhouse/client';

const options = {
  host: process.env.CLICKHOUSE_HOST,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB,
  port: process.env.CLICKHOUSE_PORT || '8123',
};

export const clickhouse = createClient({
  url: `http://${options.username}:${encodeURIComponent(options.password)}@${
    options.host
  }:${options.port}`,
  database: options.database,
});
