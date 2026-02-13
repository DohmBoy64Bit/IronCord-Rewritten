import { TEST_DB_CONFIG, TEST_IRC_CONFIG } from './setup-real-services.js';

export const getTestDBConfig = () => ({
  ...TEST_DB_CONFIG,
  connectionString: `postgresql://${TEST_DB_CONFIG.user}:${TEST_DB_CONFIG.password}@${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}/${TEST_DB_CONFIG.database}`,
});

export const getTestIRCConfig = () => ({
  ...TEST_IRC_CONFIG,
});

export const TEST_ENV = {
  DB_HOST: TEST_DB_CONFIG.host,
  DB_PORT: String(TEST_DB_CONFIG.port),
  DB_USER: TEST_DB_CONFIG.user,
  DB_PASSWORD: TEST_DB_CONFIG.password,
  DB_NAME: TEST_DB_CONFIG.database,
  IRC_HOST: TEST_IRC_CONFIG.host,
  IRC_PORT: String(TEST_IRC_CONFIG.port),
};

export function setTestEnv(): void {
  Object.entries(TEST_ENV).forEach(([key, value]) => {
    process.env[key] = value;
  });
}
