# IronCord Resilience Testing Suite

Comprehensive resilience and reconnection testing for the IronCord v2 system.

## Overview

This test suite validates system resilience across:
- **IRC Server Reconnection**: Auto-reconnection with exponential backoff
- **Database Reconnection**: Connection pool resilience and data integrity
- **Gateway Reconnection**: WebSocket reconnection and authentication persistence
- **System-Wide Resilience**: Complete system recovery and cascading failure handling

## Prerequisites

### Running Services
All tests require the test infrastructure services to be running:

```bash
# Start test services
podman compose -f podman-compose.test.yml up -d

# Verify services are healthy
podman compose -f podman-compose.test.yml ps
```

### Required Services
- **PostgreSQL** (port 5433): Test database
- **Ergo IRC** (port 6668): Test IRC server
- **Gateway** (port 3000): REST + WebSocket API server

## Running Tests

### Run All Resilience Tests
```bash
cd tests/resilience
npm test
```

### Run Specific Test Suites

#### IRC Reconnection Tests
```bash
npm run test:irc
```

Tests:
- ✅ Auto-reconnect after IRC server restart
- ✅ Exponential backoff behavior
- ✅ Reconnect failure after max retries
- ✅ State maintenance after reconnection

#### Database Reconnection Tests
```bash
npm run test:db
```

Tests:
- ✅ Graceful handling of database restart
- ✅ Data integrity across restarts
- ✅ Connection pool exhaustion handling
- ✅ Transaction integrity during failures
- ✅ Recovery from temporary connection loss

#### Gateway Reconnection Tests
```bash
npm run test:gateway
```

Tests:
- ✅ REST API availability during issues
- ✅ WebSocket reconnection gracefully
- ✅ Authentication persistence after reconnection
- ✅ Invalid authentication handling
- ✅ Concurrent WebSocket connections
- ✅ Meaningful error messages

#### System-Wide Resilience Tests
```bash
npm run test:system
```

Tests:
- ✅ Complete system restart recovery
- ✅ Cascading failure handling
- ✅ Data integrity during failures
- ✅ Network partition handling
- ✅ Clear error messages during failures

## Test Architecture

### IRC Reconnection Logic
- **Max Retries**: 10 attempts (configurable)
- **Initial Delay**: 1000ms
- **Max Delay**: 30000ms (30 seconds)
- **Backoff Strategy**: Exponential (delay × 2^attempt)

### Database Connection Pool
- **Retry Logic**: 10 attempts for schema initialization
- **Retry Delay**: 2000ms between attempts
- **Pool Management**: PostgreSQL connection pool with auto-reconnection
- **Transaction Safety**: ROLLBACK on errors, COMMIT on success

### Gateway WebSocket
- **Client Reconnection**: Socket.IO client handles reconnection
- **Server Resilience**: Per-user IRC client instance management
- **Authentication**: JWT token validation on each connection
- **Error Handling**: Graceful error emission to clients

## Container Control

Tests use Podman commands to simulate failures:

### Restart Container
```bash
podman restart ironcord-test-irc
podman restart ironcord-test-db
```

### Pause/Unpause (Network Partition Simulation)
```bash
podman pause ironcord-test-db
podman unpause ironcord-test-db
```

### Check Container Status
```bash
podman ps -a | grep ironcord-test
```

## Verification Checklist

After running resilience tests, verify:

- [ ] Auto-reconnects to IRC server after restart
- [ ] Handles database restart gracefully
- [ ] Clients reconnect to Gateway after restart
- [ ] No data loss during failures
- [ ] Users receive appropriate error messages
- [ ] System recovers automatically

## Expected Results

### IRC Reconnection
- **Connection Time**: <5 seconds after server recovery
- **Reconnection Events**: Emitted with attempt number and delay
- **State Preservation**: Channels, users, presence maintained

### Database Reconnection
- **Data Integrity**: 100% user and guild data preserved
- **Transaction Safety**: Failed transactions rolled back completely
- **Pool Recovery**: Connection pool recovers within 5 seconds

### Gateway Reconnection
- **WebSocket Reconnection**: <3 seconds after disconnect
- **Authentication**: JWT token remains valid across reconnections
- **Concurrent Connections**: Supports 10+ simultaneous connections

### System Recovery
- **Full Restart Recovery**: <30 seconds for complete system
- **Cascading Failures**: Gateway remains operational during IRC/DB issues
- **Error Messages**: Clear, actionable error messages to clients

## Troubleshooting

### Tests Timeout
- Verify services are running: `podman compose -f podman-compose.test.yml ps`
- Check service logs: `podman compose -f podman-compose.test.yml logs`
- Increase test timeouts in `vitest.config.ts`

### Podman Permission Errors
- Ensure Podman is running: `podman info`
- Check container status: `podman ps -a`
- Restart Podman service if needed

### Connection Refused Errors
- Verify correct ports: DB=5433, IRC=6668, Gateway=3000
- Check firewall settings
- Verify environment variables in `vitest.config.ts`

## Continuous Testing

For CI/CD integration:

```bash
# Start services
podman compose -f podman-compose.test.yml up -d

# Wait for health checks
sleep 10

# Run resilience tests
cd tests/resilience && npm test

# Cleanup
podman compose -f podman-compose.test.yml down --volumes
```

## Performance Metrics

Target metrics for resilience:
- **IRC Reconnection**: <5s after server recovery
- **Database Recovery**: <3s after restart
- **WebSocket Reconnection**: <2s after disconnect
- **Full System Recovery**: <30s after complete restart

## Notes

- All tests use **real services** (no mocks)
- Tests are **isolated** and can run concurrently
- Container restarts are **automatic** via test code
- Tests validate **both** recovery and error handling
