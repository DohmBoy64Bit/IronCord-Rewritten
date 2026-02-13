# AI Assistant Reference Guide

## Useful Commands and Scripts

### Line Count Verification
```bash
python check_line_counts.py
```
This script verifies all TypeScript source files are under 300 lines (Industrial Grade constraint).
- Excludes test files (.test.ts, .spec.ts)
- Excludes type declaration files (.d.ts)
- Excludes node_modules, dist, build, etc.

### Testing Commands

#### Run All Tests
```bash
npm test
```

#### Run Specific Package Tests
```bash
npm test --workspace=@ironcord/shared
npm test --workspace=@ironcord/engine
npm test --workspace=@ironcord/db
npm test --workspace=@ironcord/gateway
```

#### Run Tests with Coverage
```bash
npm run test:coverage --workspace=@ironcord/shared
npm run test:coverage --workspace=@ironcord/engine
npm run test:coverage --workspace=@ironcord/db
```

#### Type Checking
```bash
npm run typecheck
npm run typecheck --workspace=@ironcord/gateway
```

#### Building
```bash
npm run build
npm run build --workspace=@ironcord/gateway
```

### Podman Infrastructure

#### Start Services
```bash
podman compose up -d
```

#### Stop Services
```bash
podman compose down
```

#### Stop with Volume Cleanup
```bash
podman compose down --volumes
```

#### View Logs
```bash
podman compose logs -f app
podman compose logs -f db
```

#### Rebuild Images
```bash
podman compose build --no-cache
```

### Test Services (PostgreSQL + Ergo IRC)

#### Start Test Services
```bash
podman compose -f podman-compose.test.yml up -d
```

#### Stop Test Services
```bash
podman compose -f podman-compose.test.yml down --volumes
```

## Project Structure

```
IronCord v2/
├── packages/              # Shared packages
│   ├── shared/           # Common types, utils, logger
│   ├── engine/           # IRC protocol engine
│   └── db/               # Database service layer
├── apps/                 # Applications
│   ├── gateway/          # REST + WebSocket API server
│   └── client/           # Electron desktop client
├── infra/                # Infrastructure
│   ├── podman/           # Dockerfiles and configs
│   └── scripts/          # Deployment scripts
└── tests/                # Integration test setup
```

## Key Architecture Principles

1. **Industrial Grade**: DRY, strictly typed, modular
2. **File Size Limit**: Max 300 lines per file (excluding tests)
3. **No God Files**: Logic must be split into focused modules
4. **Test Coverage**: >80% for engine/db, >90% for shared
5. **Type Safety**: No `any` types allowed
6. **Real Service Testing**: All tests use real PostgreSQL and Ergo IRC

## Environment Variables

### Required (Production)
- `JWT_SECRET` - JWT signing secret
- `DATABASE_URL` - PostgreSQL connection string

### Optional (Development)
- `PORT` - Gateway port (default: 3000)
- `IRC_HOST` - IRC server host (default: localhost)
- `IRC_PORT` - IRC server port (default: 6667)
- `NODE_ENV` - Environment (development/production)
- `CLIENT_ORIGIN` - CORS origin (default: *)

## Common Issues

### Build Errors
1. Run `npm install` to ensure dependencies are up to date
2. Check TypeScript errors: `npm run typecheck`
3. Clean build: `npm run clean && npm run build`

### Test Failures
1. Ensure test services are running: `podman compose -f podman-compose.test.yml ps`
2. Check service health: `podman compose -f podman-compose.test.yml logs`
3. Clean restart: `podman compose -f podman-compose.test.yml down --volumes && podman compose -f podman-compose.test.yml up -d`

### Package Import Issues
- Always use proper package exports (e.g., `@ironcord/shared/types`, not `@ironcord/shared/types/user`)
- Build all packages before running: `npm run build`
- Check `package.json` exports field for available paths
