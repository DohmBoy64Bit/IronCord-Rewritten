# IronCord v2 Testing Infrastructure

This document describes the testing infrastructure for IronCord v2, which uses **real services** (PostgreSQL and Ergo IRC) running in Podman containers for integration testing.

## Overview

The testing infrastructure follows the "Zero-Hallucination" principle by testing against **real services** instead of mocks:

- **PostgreSQL 15 Alpine** - Test database on port `5433`
- **Ergo IRC Server** - Test IRC server on port `6668`

All integration tests run against these real services to ensure accurate behavior verification.

## Prerequisites

- **Podman** installed and running
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0

### Installing Podman

**Windows:**
```powershell
winget install RedHat.Podman
```

**macOS:**
```bash
brew install podman
podman machine init
podman machine start
```

**Linux:**
```bash
sudo apt-get install podman
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Test Services

```bash
npm run test:services:start
```

This will:
- Stop and clean up any existing test containers
- Start PostgreSQL and IRC server containers
- Wait for health checks to pass
- Configure environment variables

### 3. Run Tests

```bash
npm test
```

This runs all tests across all workspaces (`@ironcord/shared`, `@ironcord/engine`, `@ironcord/db`).

### 4. Stop Test Services

```bash
npm run test:services:stop
```

This will:
- Stop all test containers
- Remove containers and volumes
- Clean up all test data

## Test Scripts

### Root-Level Scripts

- **`npm run test:services:start`** - Start test infrastructure
- **`npm run test:services:stop`** - Stop and clean up test infrastructure
- **`npm run test:services:restart`** - Restart test infrastructure
- **`npm run test:integration`** - Start services → Run all tests → Stop services
- **`npm test`** - Run tests (requires services to be running)

### Package-Level Scripts

Each package has its own test scripts:

```bash
# Run tests for a specific package
npm test --workspace=@ironcord/shared
npm test --workspace=@ironcord/engine
npm test --workspace=@ironcord/db

# Watch mode for development
npm run test:watch --workspace=@ironcord/engine

# Coverage reports
npm run test:coverage --workspace=@ironcord/db
```

## Test Configuration

### Database Configuration

Test database runs on `localhost:5433`:

```typescript
{
  host: 'localhost',
  port: 5433,
  user: 'ironcord_test',
  password: 'ironcord_test_password',
  database: 'ironcord_test',
}
```

### IRC Configuration

Test IRC server runs on `localhost:6668`:

```typescript
{
  host: 'localhost',
  port: 6668,
}
```

### Environment Variables

When test services are started, the following environment variables are automatically set:

- `DB_HOST=localhost`
- `DB_PORT=5433`
- `DB_USER=ironcord_test`
- `DB_PASSWORD=ironcord_test_password`
- `DB_NAME=ironcord_test`
- `IRC_HOST=localhost`
- `IRC_PORT=6668`

## Writing Tests

### Using Test Helpers

```typescript
import { getTestDBConfig, getTestIRCConfig, setTestEnv } from '../tests/helpers.js';

// In your test setup
setTestEnv();

// Get database config
const dbConfig = getTestDBConfig();

// Get IRC config
const ircConfig = getTestIRCConfig();
```

### Database Tests Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from '../src/database.service.js';
import { getTestDBConfig } from '../tests/helpers.js';

describe('DatabaseService', () => {
  let db: DatabaseService;

  beforeAll(async () => {
    db = new DatabaseService(getTestDBConfig());
    await db.connect();
    await db.runMigrations();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('should create a user', async () => {
    const user = await db.users.create({
      email: 'test@example.com',
      password: 'hashedpassword',
      ircNick: 'testuser',
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

### IRC Tests Example

```typescript
import { describe, it, expect } from 'vitest';
import { IRCClient } from '../src/irc-client.js';
import { getTestIRCConfig } from '../tests/helpers.js';

describe('IRCClient', () => {
  it('should connect to IRC server', async () => {
    const config = getTestIRCConfig();
    const client = new IRCClient({
      host: config.host,
      port: config.port,
      nick: 'testuser',
    });

    await client.connect();
    expect(client.isConnected()).toBe(true);
    
    await client.disconnect();
  });
});
```

## Troubleshooting

### Services Won't Start

**Check Podman is running:**
```bash
podman ps
```

**Check for port conflicts:**
```bash
# On Windows
netstat -ano | findstr "5433"
netstat -ano | findstr "6668"

# On macOS/Linux
lsof -i :5433
lsof -i :6668
```

**Manually clean up containers:**
```bash
podman compose -f podman-compose.test.yml down --volumes
```

### Tests Fail to Connect

**Verify services are healthy:**
```bash
podman compose -f podman-compose.test.yml ps
```

**Check service logs:**
```bash
podman logs ironcord-test-db
podman logs ironcord-test-irc
```

**Verify health checks:**
```bash
podman inspect ironcord-test-db --format='{{.State.Health.Status}}'
podman inspect ironcord-test-irc --format='{{.State.Health.Status}}'
```

### Permission Issues (Podman Rootless)

If running Podman rootless and encountering permission issues:

```bash
# Check user namespace configuration
podman system info | grep -i rootless

# Reset Podman if needed
podman system reset
```

## CI/CD Integration

For CI/CD pipelines, use the `test:integration` script:

```bash
npm run test:integration
```

This script:
1. Starts test services
2. Runs all tests
3. Stops and cleans up services (even if tests fail)

Example GitHub Actions:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install Podman
        run: |
          sudo apt-get update
          sudo apt-get install -y podman
      - name: Install dependencies
        run: npm ci
      - name: Run integration tests
        run: npm run test:integration
```

## Test Coverage Requirements

- **`@ironcord/shared`**: >90% coverage
- **`@ironcord/engine`**: >80% coverage
- **`@ironcord/db`**: >80% coverage

Generate coverage reports:

```bash
npm run test:coverage --workspace=@ironcord/db
npm run test:coverage --workspace=@ironcord/engine
```

## Architecture

### Test Infrastructure Files

```
tests/
├── config/
│   └── ergo.yaml              # IRC server test configuration
├── setup-real-services.ts     # Start Podman containers and wait for health
├── teardown-real-services.ts  # Stop and cleanup containers
├── global-setup.ts            # Vitest global setup
├── global-teardown.ts         # Vitest global teardown
├── helpers.ts                 # Test utilities and config getters
└── tsconfig.json              # TypeScript config for tests

podman-compose.test.yml        # Podman Compose test services definition
```

### Service Lifecycle

1. **Setup**: `setup-real-services.ts`
   - Cleans up existing containers
   - Starts PostgreSQL and IRC containers
   - Waits for health checks (max 30 retries, 1s delay)
   - Sets environment variables

2. **Tests**: Vitest
   - Imports test helpers
   - Connects to real services
   - Runs integration tests

3. **Teardown**: `teardown-real-services.ts`
   - Stops all containers
   - Removes volumes
   - Cleans up all test data

## Best Practices

1. **Always clean up**: Use `afterAll` hooks to clean up test data
2. **Isolate tests**: Each test should be independent and not rely on previous test state
3. **Use real services**: Never mock database or IRC interactions in integration tests
4. **Fast feedback**: Keep tests fast by minimizing network round-trips
5. **Descriptive names**: Use clear, descriptive test names that explain what is being tested
6. **Test error cases**: Don't just test happy paths - test error handling too

## Support

For issues with the test infrastructure:

1. Check this documentation
2. Review package-specific test files
3. Check Podman logs for service issues
4. Consult the project's main README.md
