# IronCord E2E Tests

## Overview

End-to-end tests for the IronCord Electron client using Playwright.

## Test Suites

1. **auth.spec.ts** - Authentication flow testing
   - User registration
   - User login
   - Invalid credentials handling
   - Form validation

2. **guilds.spec.ts** - Guild management testing
   - Guild creation from scratch
   - Guild creation from templates
   - Guild name validation
   - Guild switching
   - Modal interactions

3. **messaging.spec.ts** - Message send/receive testing
   - Sending messages
   - Message display
   - Input clearing after send
   - Empty message validation
   - Author nickname display
   - Message search

4. **history.spec.ts** - Message history retrieval testing
   - Loading history on channel join
   - Welcome messages for new channels
   - Message order preservation
   - Timestamps display

5. **presence.spec.ts** - User presence testing
   - Online status after login
   - Member list presence
   - Presence across channel switches
   - Nickname consistency
   - Activity indicators

6. **reconnection.spec.ts** - Reconnection resilience testing
   - UI state maintenance during disconnections
   - Network interruption recovery
   - Guild and channel state preservation
   - Message history preservation after reconnect
   - Message sending after reconnection

## Running Tests

### Prerequisites

1. Start the backend services:
   ```bash
   podman compose -f podman-compose.yml up -d
   ```

2. Ensure the gateway is accessible at `http://localhost:3000`

3. Build the client application (see note below)

### Execute Tests

```bash
npm run test:e2e --workspace=@ironcord/client
```

### Run with UI

```bash
npm run test:e2e:ui --workspace=@ironcord/client
```

## Known Issues

### Client Build Issue

The client currently has a build issue related to Vite/ESM configuration:

```
ERROR: [plugin: externalize-deps] "vite" resolved to an ESM file. 
ESM file cannot be loaded by `require`.
```

This is a pre-existing issue with the Electron Forge + Vite configuration. The tests are fully implemented and ready to run once this build issue is resolved.

**Possible Solutions:**
1. Update vite config files to use CommonJS exports
2. Update client package.json to include proper ESM configuration
3. Upgrade @electron-forge/plugin-vite to latest version
4. Use alternative Electron bundler configuration

## Test Infrastructure

- **playwright.config.ts** - Playwright configuration for Electron
- **fixtures.ts** - Custom Playwright fixtures for Electron app lifecycle
- **helpers.ts** - Utility functions for test operations

## Test Environment

- **Gateway URL**: `http://localhost:3000`
- **Gateway WebSocket**: `ws://localhost:3000`
- **Test Mode**: `NODE_ENV=test`
- **Services**: Real PostgreSQL database and IRC server (no mocks)

## Coverage

All E2E tests are designed to test against real backend services:
- Real PostgreSQL database
- Real Ergo IRC server
- Real Gateway API
- Real WebSocket connections

No mocking is used to ensure tests validate actual end-to-end functionality.
