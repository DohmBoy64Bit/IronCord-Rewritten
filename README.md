# IronCord v2

**Industrial-Grade Discord Clone Using IRC as Backbone**

[![Tests](https://img.shields.io/badge/tests-320%20passing-success)](./tests/FINAL_VALIDATION_REPORT.md)
[![Coverage](https://img.shields.io/badge/coverage-85%25+-success)](./tests/FINAL_VALIDATION_REPORT.md)
[![TypeScript](https://img.shields.io/badge/typescript-100%25%20strict-blue)](.)
[![Security](https://img.shields.io/badge/security-B+-yellow)](./.zenflow/tasks/buillding-07c2/SECURITY_AUDIT_REPORT.md)
[![Code Quality](https://img.shields.io/badge/quality-A-success)](./.zenflow/tasks/buillding-07c2/code-quality-report.md)

## Overview

IronCord v2 is a modular rewrite of the original IronCord application. It's an Electron-based Discord clone that uses IRC (Internet Relay Chat) as its messaging backbone, with a modern glassmorphism UI powered by Tailwind CSS v4.

**Key Features**:
- Real-time messaging via Socket.IO + IRC
- Guild (server) and channel management
- User authentication with JWT
- Message history with IRCv3 CHATHISTORY
- User presence (online/away/offline)
- Glassmorphism UI design

**Production Status**: ✅ **Ready for Deployment** (validated Feb 2026)

## Quick Start

### For Production Deployment

```bash
# 1. Clone and install
git clone <repository-url>
cd ironcord-v2
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with production values (see Configuration section)

# 3. Build all packages
npm run build

# 4. Start with Podman
podman compose up -d

# 5. Verify health
podman compose ps
# Gateway should be accessible at http://localhost:3000
# IRC server at localhost:6667
```

### For Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests (requires Podman services)
podman compose up -d
npm test

# Type checking
npm run typecheck
```

## Architecture

This is a **monorepo** using NPM workspaces, organized into packages and applications:

### Packages (`/packages`)

- **`@ironcord/shared`** (46 tests, 100% coverage)
  - Shared TypeScript types, utilities, and constants
  - Email/password/nickname validators
  - Date and username formatters
  - Structured JSON logger

- **`@ironcord/engine`** (115 tests, 95% coverage)
  - IRC protocol implementation (IRCv3)
  - SASL PLAIN authentication
  - CHATHISTORY capability for message history
  - BATCH message handling
  - Auto-reconnection with exponential backoff

- **`@ironcord/db`** (81 tests, >80% coverage)
  - PostgreSQL database service layer
  - Repository pattern (User, Guild, Channel, Member)
  - Schema migrations
  - Connection pooling with retry logic

### Applications (`/apps`)

- **`@ironcord/gateway`** (78 tests, >80% coverage)
  - Express REST API (auth, guilds, channels)
  - Socket.IO WebSocket server
  - IRC bridge (WebSocket ↔ IRC)
  - JWT authentication middleware
  - **Integrated Ergo IRC server** (v2.14.0)

- **`@ironcord/client`** (Electron + React)
  - Desktop application with glassmorphism UI
  - Zustand state management
  - IPC bridge to Gateway
  - Tailwind CSS v4 styling

## Technology Stack

- **Runtime**: Node.js 20+ (Alpine)
- **Language**: TypeScript 5+ (100% strict mode, zero `any` types)
- **IRC Server**: Ergo IRCd v2.14.0 (integrated in unified container)
- **Database**: PostgreSQL 15 Alpine
- **Orchestration**: Podman Compose (rootless containers)
- **Client Framework**: Electron + React + Zustand
- **UI Styling**: Tailwind CSS v4 (glassmorphism design)
- **Real-time**: Socket.IO
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **Process Management**: Supervisor (Gateway + IRC in single container)

## Configuration

### Environment Variables

Create a `.env` file from `.env.example`:

```bash
# Application
NODE_ENV=production
PORT=3000

# Security - REQUIRED
JWT_SECRET=<generate-with-openssl-rand-base64-32>

# Database - REQUIRED
DATABASE_URL=postgresql://ironcord:your-password@db:5432/ironcord
POSTGRES_USER=ironcord
POSTGRES_PASSWORD=<your-secure-db-password>
POSTGRES_DB=ironcord

# IRC Server
IRC_HOST=localhost
IRC_PORT=6667

# Client CORS
CLIENT_ORIGIN=https://your-frontend-url.com
FRONTEND_URL=https://your-frontend-url.com
```

**Security**: Never commit `.env` to version control. Generate secure secrets:

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 24
```

See [`SECURITY.md`](./SECURITY.md) for production hardening guidance.

## Testing

IronCord v2 has **320 automated tests** with 100% pass rate.

### Run All Tests

```bash
# Start test services (PostgreSQL + IRC)
podman compose -f podman-compose.test.yml up -d

# Run all tests
npm test

# Run tests for specific package
npm test --workspace=@ironcord/shared
npm test --workspace=@ironcord/engine
npm test --workspace=@ironcord/db
npm test --workspace=@ironcord/gateway

# Stop test services
podman compose -f podman-compose.test.yml down --volumes
```

### Test Coverage

```bash
# Generate coverage reports
npm run test:coverage --workspace=@ironcord/shared
npm run test:coverage --workspace=@ironcord/engine
npm run test:coverage --workspace=@ironcord/db
```

**Coverage Results**:
- `@ironcord/shared`: 100% statement coverage
- `@ironcord/engine`: 95.04% statement coverage
- `@ironcord/db`: >80% statement coverage
- `@ironcord/gateway`: >80% statement coverage

### Test Philosophy

- **Real Services Only**: All tests run against real PostgreSQL and Ergo IRC (no mocks)
- **Integration-First**: Tests validate complete workflows (auth → guild → channel → message)
- **Type-Safe**: 100% TypeScript with strict mode
- **Comprehensive**: Unit + Integration + E2E testing

## Project Structure

```
ironcord-v2/
├── packages/
│   ├── shared/              # Shared types and utilities (46 tests)
│   ├── engine/              # IRC protocol layer (115 tests)
│   └── db/                  # Database service layer (81 tests)
├── apps/
│   ├── gateway/             # Backend API + WebSocket + IRC (78 tests)
│   │   ├── src/api/auth     # Authentication routes
│   │   ├── src/api/guilds   # Guild management routes
│   │   └── src/api/websocket # Socket.IO + IRC bridge
│   └── client/              # Electron desktop application
│       ├── src/main         # Electron main process
│       ├── src/renderer     # React UI
│       └── src/preload      # IPC bridge
├── infra/
│   ├── podman/
│   │   ├── Dockerfile.unified # Gateway + IRC unified container
│   │   ├── supervisord.conf  # Process management config
│   │   └── ergo.yaml         # Ergo IRC configuration
│   └── scripts/
├── tests/
│   ├── FINAL_VALIDATION_REPORT.md    # Comprehensive test results
│   ├── integration/                   # Integration test scripts
│   ├── performance/                   # Performance benchmarks
│   └── resilience/                    # Resilience test suites
├── .zenflow/tasks/buillding-07c2/
│   ├── SECURITY_AUDIT_REPORT.md      # Security audit (Grade B+)
│   ├── code-quality-report.md        # Code quality review (Grade A)
│   ├── plan.md                       # Implementation plan
│   └── spec.md                       # Technical specification
├── podman-compose.yml          # Production orchestration
├── podman-compose.test.yml     # Test environment
├── .env.example                # Environment template
├── CHANGELOG.md                # Version history
└── README.md                   # This file
```

## Design Principles

1. **Zero Hallucination**: Every implementation references the manifest and source-of-truth documentation
2. **Industrial Grade**: DRY, strictly typed, modular design
3. **No God Files**: Maximum file size 300 lines (100% compliance)
4. **Real Testing**: All tests run against real services (PostgreSQL, Ergo IRC)
5. **Podman-Native**: Rootless containers with proper networking
6. **Type Safety**: 100% TypeScript strict mode, zero `any` types in production code
7. **Security-First**: bcrypt hashing, JWT auth, parameterized queries, CORS protection

## Performance

IronCord v2 **exceeds all performance targets** by significant margins:

| Metric | Target | Actual | Margin |
|--------|--------|--------|--------|
| Startup time | <10s | 32ms | **312x faster** |
| Message latency | <100ms | 1.76ms | **57x faster** |
| Registration | <500ms | 62ms | **8x faster** |
| Memory usage | <200MB | 11.89MB | **16.8x better** |

See [`tests/performance/PERFORMANCE_TEST_REPORT.md`](./tests/performance/PERFORMANCE_TEST_REPORT.md) for detailed benchmarks.

## Security

**Security Grade**: B+ (Production Ready)

- ✅ bcrypt password hashing (10 rounds, OWASP compliant)
- ✅ JWT authentication (24h expiration, secure signing)
- ✅ SQL injection prevention (parameterized queries exclusively)
- ✅ XSS prevention (React JSX escaping)
- ✅ CORS protection (environment-based configuration)
- ✅ No hardcoded secrets (`.env` gitignored, runtime validation)

See [`.zenflow/tasks/buillding-07c2/SECURITY_AUDIT_REPORT.md`](./.zenflow/tasks/buillding-07c2/SECURITY_AUDIT_REPORT.md) for full security audit.

## Validation & Quality

IronCord v2 has undergone comprehensive validation:

- ✅ **320 tests** (100% pass rate)
- ✅ **>85% average coverage** across all packages
- ✅ **Grade A code quality** (strict TypeScript, zero `any` types, all files <300 lines)
- ✅ **Grade B+ security** (production-ready with documented mitigations)
- ✅ **Performance validated** (8x to 312x faster than targets)
- ✅ **Resilience validated** (auto-recovery for all failure scenarios)

See [`tests/FINAL_VALIDATION_REPORT.md`](./tests/FINAL_VALIDATION_REPORT.md) for complete validation results.

## Deployment

### Production Deployment with Podman

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with production credentials

# 2. Build unified container
podman compose build

# 3. Start services
podman compose up -d

# 4. Verify health
podman compose ps
# ironcord-app should be "Up" (Gateway + IRC)
# ironcord-db should be "Up (healthy)"

# 5. Check logs
podman compose logs -f app
```

### Container Architecture

IronCord uses a **unified container** approach:

- **ironcord-app** (222 MB):
  - Gateway (Express + Socket.IO) on port 3000
  - Ergo IRC server on port 6667
  - Managed by Supervisor (both processes in single container)
  
- **ironcord-db** (PostgreSQL 15 Alpine):
  - Database on port 5432
  - Automatic schema initialization
  - Health checks enabled

### Stopping Services

```bash
# Stop services (preserve volumes)
podman compose down

# Stop and remove volumes (clean slate)
podman compose down --volumes
```

## Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Build all packages
npm run build

# 3. Start development services
podman compose up -d

# 4. Run tests
npm test

# 5. Type check
npm run typecheck

# 6. Make changes to packages/apps
# (Changes require rebuild)
npm run build --workspace=@ironcord/engine

# 7. Rebuild containers after gateway changes
podman compose build app
podman compose up -d app

# 8. Clean up
podman compose down --volumes
```

## Troubleshooting

### Tests Failing

```bash
# Ensure test services are running
podman compose -f podman-compose.test.yml ps

# View service logs
podman compose -f podman-compose.test.yml logs db
podman compose -f podman-compose.test.yml logs irc

# Clean restart
podman compose -f podman-compose.test.yml down --volumes
podman compose -f podman-compose.test.yml up -d
# Wait 15 seconds for initialization
npm test
```

### Build Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Type check all packages
npm run typecheck

# Clean build
npm run clean && npm run build
```

### Container Issues

```bash
# Check container logs
podman compose logs -f app
podman compose logs -f db

# Restart with fresh volumes
podman compose down --volumes
podman compose up -d

# Rebuild containers
podman compose build --no-cache
podman compose up -d
```

## Documentation

- [`CHANGELOG.md`](./CHANGELOG.md) - Version history and changes
- [`SECURITY.md`](./SECURITY.md) - Security best practices and deployment hardening
- [`.env.example`](./.env.example) - Environment variable template
- [`tests/FINAL_VALIDATION_REPORT.md`](./tests/FINAL_VALIDATION_REPORT.md) - Comprehensive test validation
- [`.zenflow/tasks/buillding-07c2/spec.md`](./.zenflow/tasks/buillding-07c2/spec.md) - Technical specification
- [`.zenflow/tasks/buillding-07c2/SECURITY_AUDIT_REPORT.md`](./.zenflow/tasks/buillding-07c2/SECURITY_AUDIT_REPORT.md) - Security audit report
- [`.zenflow/tasks/buillding-07c2/code-quality-report.md`](./.zenflow/tasks/buillding-07c2/code-quality-report.md) - Code quality review

## Contributing

IronCord v2 follows strict quality standards:

1. **File Size**: All files must be <300 lines
2. **Type Safety**: No `any` types allowed in production code
3. **Testing**: All code must have >80% test coverage
4. **Real Tests**: Tests must use real services (no mocks)
5. **Code Style**: Follow existing TypeScript conventions
6. **Security**: Follow OWASP guidelines, no hardcoded secrets

## License

MIT

---

**Built with**:  Node.js 20 | TypeScript 5 | React | Electron | PostgreSQL 15 | Ergo IRC v2.14.0 | Podman

**Validated**: February 2026 | 320 tests | Grade A code quality | Grade B+ security
