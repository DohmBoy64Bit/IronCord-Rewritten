import { execSync } from 'child_process';
import { Client } from 'pg';
import { createConnection } from 'net';

const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 1000;

const TEST_DB_CONFIG = {
  host: 'localhost',
  port: 5433,
  user: 'ironcord_test',
  password: 'ironcord_test_password',
  database: 'ironcord_test',
};

const TEST_IRC_CONFIG = {
  host: 'localhost',
  port: 6668,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function executeCommand(command: string): void {
  try {
    execSync(command, { stdio: 'inherit', windowsHide: true });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    throw error;
  }
}

async function waitForPostgres(): Promise<void> {
  console.log('Waiting for PostgreSQL to be ready...');
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const client = new Client(TEST_DB_CONFIG);
      await client.connect();
      await client.end();
      
      console.log('✓ PostgreSQL is ready');
      return;
    } catch (error) {
      if (i === MAX_RETRIES - 1) {
        throw new Error(`PostgreSQL failed to start after ${MAX_RETRIES} attempts`);
      }
      await sleep(RETRY_DELAY_MS);
    }
  }
}

async function waitForIRC(): Promise<void> {
  console.log('Waiting for IRC server to be ready...');
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = createConnection({
          host: TEST_IRC_CONFIG.host,
          port: TEST_IRC_CONFIG.port,
        });
        
        socket.on('connect', () => {
          socket.end();
          resolve();
        });
        
        socket.on('error', (err) => {
          reject(err);
        });
        
        setTimeout(() => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        }, 5000);
      });
      
      console.log('✓ IRC server is ready');
      return;
    } catch (error) {
      if (i === MAX_RETRIES - 1) {
        throw new Error(`IRC server failed to start after ${MAX_RETRIES} attempts`);
      }
      await sleep(RETRY_DELAY_MS);
    }
  }
}

async function startServices(): Promise<void> {
  console.log('Starting test services with Podman Compose...');
  
  try {
    executeCommand('podman compose -f podman-compose.test.yml down --volumes');
  } catch (error) {
    console.log('No existing containers to clean up');
  }
  
  executeCommand('podman compose -f podman-compose.test.yml up -d');
  
  await Promise.all([
    waitForPostgres(),
    waitForIRC(),
  ]);
  
  console.log('✓ All test services are ready');
}

export { startServices, TEST_DB_CONFIG, TEST_IRC_CONFIG };

startServices()
  .then(() => {
    console.log('\n✓ Test infrastructure setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Failed to setup test infrastructure:', error);
    process.exit(1);
  });
