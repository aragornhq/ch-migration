import { ClickHouseClient, createClient } from '@clickhouse/client';

let cachedClient: ClickHouseClient | null = null;

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Environment variable ${key} is required to connect to ClickHouse`,
    );
  }
  return value;
};

const createClickHouseClient = () => {
  const host = getRequiredEnv('CH_HOST');
  const username = getRequiredEnv('CH_USER');
  const database = getRequiredEnv('CH_DB');
  const port = getRequiredEnv('CH_PORT');
  const password = process.env.CH_PASSWORD || '';
  const useTls = process.env.CH_USE_TLS === 'true';

  const protocol = useTls ? 'https' : 'http';

  return createClient({
    url: `${protocol}://${username}:${encodeURIComponent(password)}@${host}:${port}`,
    database,
  });
};

export const getClickhouseClient = (): ClickHouseClient => {
  if (!cachedClient) {
    cachedClient = createClickHouseClient();
  }
  return cachedClient;
};
