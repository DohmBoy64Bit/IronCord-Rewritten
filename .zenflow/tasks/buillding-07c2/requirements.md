# IronCord v2 Modular Rewrite - Product Requirements Document

## Executive Summary

IronCord v2 represents a complete architectural modernization of the existing Discord-like IRC-backed desktop chat application. The rewrite transitions from a loosely organized monolithic structure to a **strictly modular monorepo** following "Industrial Grade" principles: DRY, strictly typed, and eliminating all "God Files."

---

## 🚨 CRITICAL TESTING MANDATE 🚨

**ZERO TOLERANCE POLICY FOR TEST FAILURES**

This project operates under **STRICT REAL-WORLD TESTING REQUIREMENTS**:

### Absolute Rules (NO EXCEPTIONS):
1. ✅ **NO MOCK SETUPS ALLOWED**: All tests MUST use real services (real PostgreSQL, real Ergo IRC, real Socket.IO)
2. ✅ **TEST AFTER EVERY STEP**: Each implementation step is INCOMPLETE until all tests pass
3. ✅ **100% PASS RATE REQUIRED**: No step proceeds with failing tests, flaky tests, or skipped tests
4. ✅ **BLOCKING PROGRESSION**: Cannot move to next step if ANY test fails
5. ✅ **PLAYWRIGHT E2E REQUIRED**: Full frontend testing with real Electron app + real backend services
6. ✅ **NO ESCAPE HATCHES**: Cannot use `test.skip()`, `test.todo()`, or mark tests as pending

### Test Verification Checklist (EVERY STEP):
- [ ] All unit tests pass using real PostgreSQL database
- [ ] All unit tests pass using real Ergo IRC server
- [ ] All integration tests pass with full service stack running
- [ ] All Playwright E2E tests pass against real Electron application
- [ ] Tests run successfully 10 consecutive times (no flaky tests)
- [ ] Test coverage >80% measured against real code paths
- [ ] Podman containers for test services start/stop cleanly

### Enforcement:
**Implementation is NOT complete until the above checklist is 100% checked.**  
**NO moving to next phase with pending, skipped, or failing tests.**  
**NO mocked services in test suites - all tests against real infrastructure.**

---

## Project Context

### Current State (v1 - Reference Implementation)
- **Location**: `ReferenceProject/` directory
- **Architecture**: Monolithic structure with basic workspace separation
- **Orchestration**: Docker Compose (three separate services: gateway, db, irc)
- **Tech Stack**:
  - Frontend: React 19, Tailwind CSS v4, Zustand, Electron Forge
  - Gateway: Node.js, Express 5, Socket.IO
  - IRC: Ergo IRCd with IRCv3 extensions (SASL, CHATHISTORY)
  - Database: PostgreSQL 15
  - Monorepo: NPM Workspaces

### Target State (v2 - New Implementation)
- **Architecture**: Modular monorepo with clear package boundaries
- **Orchestration**: **Podman Compose** (rootless-ready)
- **Structure**:
  - `/packages` - Core shared libraries (engine, db utilities)
  - `/apps` - Deployable applications (gateway, client)
- **Infrastructure**: **Single unified Dockerfile** integrating gateway, IRC server, and PostgreSQL

## Core Requirements

### 1. Architectural Transformation

#### 1.1 Modular Monorepo Structure
**Requirement**: Reorganize codebase into strict modular boundaries.

**Package Structure**:
```
/packages
  /engine        - IRC protocol abstraction and core business logic
  /db            - Database service, schema, migrations
  /shared        - Shared TypeScript types, utilities, logger

/apps
  /gateway       - REST API + WebSocket server
  /client        - Electron desktop application
```

**Design Principles**:
- **No God Files**: Maximum file size of 300 lines; split into logical modules
- **DRY**: All IRC logic consolidated in `/packages/engine`
- **Strict Typing**: Full TypeScript coverage with no `any` types
- **Clear Boundaries**: Each package has explicit exports via `package.json`

#### 1.2 Package Responsibilities

**`/packages/engine`**:
- IRC protocol implementation (currently `irc-client.ts`)
- IRCv3 capability negotiation (CAP LS, SASL, CHATHISTORY)
- Connection management and reconnection logic
- Event emission for IRC events (messages, joins, parts, etc.)
- **Must Not**: Contain any Express/Socket.IO/HTTP logic

**`/packages/db`**:
- PostgreSQL connection pool management
- Schema initialization and migrations
- Database service interface (currently `db.service.ts`)
- Query builders for Users, Guilds, Channels, Messages
- **Must Not**: Contain business logic or API handlers

**`/packages/shared`**:
- TypeScript type definitions (User, Guild, Channel, Message, etc.)
- Shared utilities (logger, validators, formatters)
- Constants and configuration schemas
- **Must Not**: Contain application-specific logic

**`/apps/gateway`**:
- Express REST API routes (auth, guilds, channels)
- Socket.IO WebSocket server
- JWT authentication middleware
- Bridge between HTTP/WS and IRC engine
- **Depends On**: `@ironcord/engine`, `@ironcord/db`, `@ironcord/shared`

**`/apps/client`**:
- Electron main process (window management, IPC)
- React renderer (UI components)
- Zustand state management
- Preload script (IPC bridge)
- **Depends On**: `@ironcord/shared` (types only)

### 2. Infrastructure Consolidation

#### 2.1 Single Unified Dockerfile
**Requirement**: Merge gateway, IRC server (Ergo), and PostgreSQL into a **single Docker image** managed via Podman Compose.

**Rationale**:
- Simplify deployment to a single container for development/testing
- Reduce network complexity (no bridge networking overhead)
- Easier local development setup

**Technical Approach**:
- Multi-stage Dockerfile with separate build stages for each service
- Use supervisord or similar process manager to run all services
- PostgreSQL runs as a background process within the container
- Ergo IRC server runs as a background process
- Gateway runs as the primary foreground process

**Configuration**:
- PostgreSQL data directory: `/var/lib/postgresql/data`
- Ergo configuration: `/etc/ergo/ircd.yaml`
- Gateway environment variables for DB/IRC connection strings

#### 2.2 Podman-Native Orchestration
**Requirement**: Use `podman compose` instead of Docker Compose.

**Key Differences to Account For**:
- Rootless mode by default (UID mapping considerations)
- Different networking defaults (CNI vs bridge)
- Volume mount permissions handling
- No Docker daemon dependency

**Deliverables**:
- `podman-compose.yml` at project root
- `clean_build.ps1` script updated for Podman commands
- Health checks for all services within the unified container

### 3. Feature Parity with v1

#### 3.1 IRC Protocol Features
**Requirement**: Maintain 100% functional parity with v1 IRC capabilities.

**IRCv3 Extensions**:
- **SASL PLAIN Authentication**: User authentication via IRC SASL
- **CHATHISTORY**: Message history retrieval using `CHATHISTORY LATEST`
- **Message Tags**: Parse `msgid`, `time`, `account` tags from PRIVMSG
- **CAP Negotiation**: Support `CAP LS 302`, `CAP REQ`, `CAP END`

**IRC Commands**:
- `NICK`, `USER`, `PASS` - User registration
- `JOIN`, `PART`, `KICK`, `QUIT` - Channel management
- `PRIVMSG` - Message sending
- `AWAY` - Presence status mapping
- `NAMES` - Channel member list

**Connection Management**:
- Automatic reconnection with exponential backoff
- Batch message handling for CHATHISTORY
- Channel member tracking
- Registration state management

#### 3.2 Gateway API
**Requirement**: Maintain all existing REST and WebSocket endpoints.

**REST Endpoints** (Express):
- `POST /auth/register` - User registration with email/password
- `POST /auth/login` - JWT-based authentication
- `GET /guilds/mine` - List user's guilds
- `POST /guilds` - Create new guild (auto-creates #general)
- `GET /guilds/:id/channels` - List guild channels
- `POST /guilds/:id/channels` - Create new channel

**WebSocket Events** (Socket.IO):
- `irc:connect` - Client initiates IRC connection via gateway
- `irc:message` - Send message to channel
- `irc:join` - Join IRC channel
- `irc:part` - Leave channel
- `irc:history` - Request message history
- `irc:presence` - Update user presence (maps to AWAY)

**Server Events** (emitted to client):
- `irc:registered` - IRC registration confirmed
- `irc:connected` - TCP connection established
- `irc:disconnected` - Connection lost
- `irc:message` - New message received
- `irc:history` - Batch history messages
- `irc:members` - Channel member list update
- `irc:error` - Error occurred

#### 3.3 Desktop Client (Electron)
**Requirement**: Preserve UI/UX design and functionality.

**UI Components**:
- **TitleBar**: Custom window controls with drag region
- **Sidebar**: Server/guild navigation with icons
- **ChannelList**: Channel list with context menus, settings modal
- **Chat**: Message view, input, member panel, search
- **Login/Register**: Authentication screens
- **CreateGuildModal**: Multi-step guild creation wizard
- **ServerSettingsModal**: Guild management interface

**IPC Bridge** (`window.ironcord`):
- `register(data)`, `login(credentials)`
- `connectIRC(userId, config)`
- `sendMessage(channel, message)`
- `getMyGuilds()`, `getChannels(guildId)`
- `createGuild(name)`, `createChannel(guildId, name)`
- `setPresence(status)`
- Event listeners: `onIRCMessage`, `onIRCHistory`, `onIRCMembers`, etc.

**State Management** (Zustand):
- User authentication state
- Guild and channel lists
- Message history per channel
- Channel member lists
- User presence tracking

**Styling**:
- **Glassmorphism Design**: Maintain `.glass-panel` class with backdrop blur
- **Tailwind CSS v4**: Continue using Tailwind for all styles
- **Color Palette**: Discord-inspired dark theme (#313338, #2b2d31, #1e1f22)
- **Custom Scrollbars**: Styled webkit scrollbars

### 4. Database Schema
**Requirement**: Maintain exact schema from v1 with no breaking changes.

**Tables**:
- `users`: id (UUID), email, password_hash, irc_nick, avatar_url, created_at
- `guilds`: id (UUID), name, owner_id, irc_namespace_prefix, created_at
- `channels`: id (UUID), guild_id, name, irc_channel_name, topic, created_at
- `guild_members`: guild_id, user_id, joined_at (composite PK)

**Extensions**:
- `uuid-ossp` for UUID generation

**Indexes** (to be added in v2):
- Index on `users.irc_nick` for fast IRC nick lookups
- Index on `channels.irc_channel_name` for IRC-to-channel mapping

### 5. Development Workflow

#### 5.1 Build & Test Scripts
**Requirement**: Maintain NPM workspace scripts from v1.

**Root Package Scripts**:
- `npm run build` - Build all workspaces
- `npm test` - Run all workspace tests
- `npm run test:e2e` - Playwright end-to-end tests

**Gateway Scripts**:
- `npm run build` - TypeScript compilation
- `npm run dev` - Development server with ts-node
- `npm test` - Vitest unit tests
- `npm start` - Production server (node dist/index.js)

**Client Scripts**:
- `npm start` - Electron Forge development mode
- `npm run build` - Package Electron app
- `npm test` - Vitest + React Testing Library
- `npm run lint` - ESLint

#### 5.2 Testing Strategy
**Requirement**: **CRITICAL** - Real-world testing only, zero tolerance for test failures.

**🚨 MANDATORY TESTING RULES**:

1. **NO MOCK SETUPS ALLOWED**: All tests must use real services (real PostgreSQL, real Ergo IRC, real Socket.IO connections)
2. **TEST AFTER EVERY STEP**: Each implementation step must include comprehensive tests that pass before proceeding
3. **ALL TESTS MUST PASS**: No step is considered complete until 100% of tests pass
4. **BLOCKING REQUIREMENT**: Cannot move to next step if any test fails
5. **REAL-WORLD INTEGRATION**: Tests must validate actual end-to-end flows, not isolated units with mocks

**Unit Tests** (Real Services Required):
- `/packages/engine`: IRC protocol parsing with **real Ergo IRC server connection**
  - Test SASL authentication against live Ergo instance
  - Test CHATHISTORY against real message history storage
  - Test CAP negotiation with actual IRC server responses
  - Test reconnection logic with real network disconnects
- `/packages/db`: Database service methods with **real PostgreSQL instance**
  - Test schema initialization on actual database
  - Test all CRUD operations with real transactions
  - Test constraint violations and error handling
  - Test concurrent access patterns
- `/apps/gateway`: API route handlers with **real database + IRC connections**
  - Test auth routes with real bcrypt hashing and JWT signing
  - Test guild creation with actual database inserts and IRC channel creation
  - Test WebSocket events with real Socket.IO server and IRC bridge

**Integration Tests** (Full Stack Required):
- **Gateway + IRC Engine + Database**: Complete message flow
  - Start real PostgreSQL container
  - Start real Ergo IRC server
  - Start Gateway with real connections to both
  - Test full user registration → IRC SASL auth → message send → database persistence
- **Socket.IO Authentication Chain**:
  - Real JWT generation → WebSocket auth → IRC connection establishment
  - Test token expiration and reconnection flows
- **CHATHISTORY Integration**:
  - Send 100 messages to IRC channel
  - Disconnect and reconnect client
  - Verify history retrieval matches sent messages

**E2E Tests** (Playwright - Full Application):
- **Mandatory Setup**: Playwright configured to test against running Electron app
- **Required Test Suites**:
  1. **User Registration & Login Flow**:
     - Register new user → verify database record → login → verify JWT token
  2. **Guild Creation & Channel Management**:
     - Create guild → verify IRC namespace creation → create channel → verify IRC channel exists
  3. **Message Send & Receive**:
     - Send message from client → verify IRC PRIVMSG → verify database storage → verify recipient receives
  4. **History Retrieval on Join**:
     - Pre-populate 50 messages in channel
     - Join channel → verify CHATHISTORY request → verify all messages loaded in UI
  5. **Multi-User Presence**:
     - Two clients connected → User A sets AWAY → verify User B sees presence update
  6. **Reconnection Resilience**:
     - Kill IRC server → verify client shows disconnected → restart IRC → verify auto-reconnect

**Test Execution Requirements**:
- Every test must spin up real services via `podman compose up`
- Tests must clean up data between runs (reset database, clear IRC state)
- Tests must include assertions on actual network traffic (not mocked responses)
- Tests must validate both success and failure paths with real errors

**Test Infrastructure**:
- `tests/setup-real-services.ts`: Script to start Podman containers for tests
- `tests/teardown-real-services.ts`: Script to stop and clean up containers
- `playwright.config.ts`: Configured to launch real Electron app against test services
- `vitest.config.ts`: Configured with real service connection strings

**Pass Criteria Per Step**:
- ✅ All unit tests pass (100% success rate)
- ✅ All integration tests pass (100% success rate)
- ✅ All E2E tests pass (100% success rate)
- ✅ No flaky tests (tests must pass 10 consecutive times)
- ✅ Test coverage >80% for all packages (measured against real code paths)

**Failure Protocol**:
- ❌ If ANY test fails, implementation is INCOMPLETE
- ❌ Must fix root cause before proceeding to next step
- ❌ Cannot skip tests or mark as "TODO"
- ❌ Cannot use `test.skip()` or similar escape hatches

### 6. Configuration & Environment

#### 6.1 Environment Variables
**Requirement**: Centralize configuration for the unified container.

**Gateway Service**:
- `PORT`: API port (default: 3000)
- `NODE_ENV`: production | development
- `JWT_SECRET`: Token signing secret (required in production)
- `CORS_ORIGIN`: Allowed frontend origin

**Database**:
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: ironcord)
- `DB_USER`: Database user (default: ironcord)
- `DB_PASSWORD`: Database password (required)

**IRC Server**:
- `IRC_HOST`: Ergo IRC host (default: localhost)
- `IRC_PORT`: IRC port (default: 6667)

#### 6.2 Ergo IRC Configuration
**Requirement**: Maintain Ergo configuration for SASL and CHATHISTORY.

**Key Settings** (from `infra/ircd/ergo.conf`):
```yaml
network:
  name: IronCord-Net

accounts:
  authentication-enabled: true
  registration:
    enabled: true
    allow-unconfirmed-sessions: true

history:
  enabled: true
  channel-storage:
    enabled: true
    duration: 7d
    capacity: 1000

chathistory:
  enabled: true
  channel-length: 1000
  client-length: 100
```

## Non-Functional Requirements

### NFR-1: Code Quality
- **Linting**: ESLint for all TypeScript code
- **Formatting**: Prettier with consistent config
- **Type Safety**: Strict TypeScript mode (`strict: true`)
- **File Size**: No files exceeding 300 lines (split into modules)

### NFR-2: Performance
- **Startup Time**: Gateway + IRC + DB startup < 10 seconds
- **Message Latency**: WS → IRC → WS roundtrip < 100ms
- **History Load**: 100 messages retrieved in < 500ms

### NFR-3: Security
- **Authentication**: JWT tokens with configurable expiration
- **Password Hashing**: bcrypt with 10 rounds minimum
- **SASL**: Secure IRC authentication via SASL PLAIN
- **Environment Secrets**: No hardcoded secrets in codebase

### NFR-4: Developer Experience
- **Hot Reload**: Gateway dev mode with ts-node watch
- **Client HMR**: Vite hot module replacement for React
- **Quick Setup**: Single `podman compose up` command for full stack
- **Clean Rebuild**: `clean_build.ps1` for resetting Podman environment

### NFR-5: Testing Quality (CRITICAL REQUIREMENT)
- **Real Services Only**: ZERO mocked services allowed (must use real PostgreSQL, Ergo IRC, Socket.IO)
- **Test After Every Step**: Implementation incomplete until all tests pass
- **100% Pass Rate**: No tolerance for failing tests, flaky tests, or skipped tests
- **Blocking Progression**: Cannot proceed to next implementation step if any test fails
- **E2E Coverage**: Playwright tests covering all critical user journeys
- **Integration Testing**: All tests must validate actual service-to-service communication
- **Test Infrastructure**: Automated Podman container management for test environments
- **No Escape Hatches**: Cannot use `test.skip()`, `test.todo()`, or similar mechanisms

## Success Criteria

### Must Have (ZERO TOLERANCE - ALL REQUIRED)
1. ✅ All v1 features functional in v2 modular architecture
2. ✅ Single unified Dockerfile running Gateway + Ergo IRC (PostgreSQL separate)
3. ✅ Podman Compose orchestration working on Windows
4. ✅ No files exceeding 300 lines (modular design)
5. ✅ All packages have explicit boundaries and exports
6. ✅ Glassmorphism UI preserved exactly as v1
7. ✅ Full IRCv3 SASL and CHATHISTORY support
8. ✅ **ALL TESTS PASSING (100% success rate) - BLOCKING REQUIREMENT**
9. ✅ **Real-world testing only - NO MOCKS - BLOCKING REQUIREMENT**
10. ✅ **Playwright E2E tests for frontend - ALL PASSING - BLOCKING REQUIREMENT**
11. ✅ **Test coverage >80% with real service integration**
12. ✅ **Each implementation step includes passing tests**

### Should Have
1. Improved type safety (eliminate all `any` types)
2. Database migration system for schema changes
3. Comprehensive error handling and logging
4. E2E test suite covering critical user flows

### Nice to Have
1. Docker Hub image for easy deployment
2. Performance benchmarks vs v1
3. Developer documentation in `PROJECT_MANIFEST.md`
4. Automated CI/CD pipeline for builds

## Migration Strategy

**🚨 CRITICAL**: Each phase MUST include passing tests before proceeding to next phase. NO EXCEPTIONS.

### Phase 1: Package Extraction (Foundation)
- Create `/packages/engine` from `apps/gateway/src/irc-client.ts`
- Create `/packages/db` from `apps/gateway/src/services/db.service.ts`
- Create `/packages/shared` from existing type definitions
- Update import paths in gateway and client
- **TESTING REQUIRED**:
  - ✅ Unit tests for `/packages/engine` with real Ergo IRC server
  - ✅ Unit tests for `/packages/db` with real PostgreSQL
  - ✅ All tests passing (100% success rate)
  - ✅ Test coverage >80% for all packages
  - **BLOCKING**: Cannot proceed to Phase 2 until all tests pass

### Phase 2: Infrastructure Unification
- Design multi-stage Dockerfile with Ergo + Gateway
- Implement process supervisor (supervisord)
- Create `podman-compose.yml` with health checks (separate PostgreSQL container)
- Update `clean_build.ps1` for Podman
- **TESTING REQUIRED**:
  - ✅ Integration tests for Docker container startup
  - ✅ Health check validation (PostgreSQL, Ergo, Gateway all healthy)
  - ✅ Service connectivity tests (Gateway → PostgreSQL, Gateway → Ergo)
  - ✅ All tests passing (100% success rate)
  - **BLOCKING**: Cannot proceed to Phase 3 until all tests pass

### Phase 3: Gateway Modernization
- Refactor API routes to use extracted packages
- Split WebSocket logic into smaller modules
- Implement comprehensive error handling
- Add request/response validation
- **TESTING REQUIRED**:
  - ✅ Integration tests for all REST API endpoints with real database
  - ✅ Integration tests for WebSocket events with real IRC connections
  - ✅ Test auth flow (registration → JWT → Socket.IO auth → IRC SASL)
  - ✅ Test guild creation (API → DB → IRC channel creation)
  - ✅ All tests passing (100% success rate)
  - **BLOCKING**: Cannot proceed to Phase 4 until all tests pass

### Phase 4: Client Refinement
- Update imports to use shared types
- Add missing UI polish from glassmorphism design
- Implement client-side error boundaries
- Enhance IPC type safety
- **TESTING REQUIRED**:
  - ✅ Playwright E2E tests for full user flows
  - ✅ Test user registration and login through Electron UI
  - ✅ Test guild creation and channel navigation
  - ✅ Test message send/receive with real IRC backend
  - ✅ Test history retrieval on channel join
  - ✅ All E2E tests passing (100% success rate)
  - **BLOCKING**: Cannot proceed to Phase 5 until all E2E tests pass

### Phase 5: Final Testing & Validation
- Comprehensive test suite execution (all tests from previous phases)
- Performance testing and optimization
- Stress testing (100+ concurrent users, 1000+ messages)
- Reconnection resilience testing (kill/restart services)
- **FINAL VALIDATION**:
  - ✅ ALL unit tests passing (100%)
  - ✅ ALL integration tests passing (100%)
  - ✅ ALL E2E tests passing (100%)
  - ✅ No flaky tests (10 consecutive full test suite runs pass)
  - ✅ Test coverage >80% across all packages
  - ✅ Performance benchmarks met (see NFR-2)
  - **BLOCKING**: Project not complete until ALL tests pass

## Open Questions & Clarifications Needed

### Q1: Process Management in Unified Container
**Question**: Should we use supervisord, PM2, or a custom shell script to manage PostgreSQL, Ergo, and Gateway processes in the unified container?

**Options**:
- **supervisord**: Industry standard, robust, more complex config
- **PM2**: Node.js native, simpler for Gateway, less suited for PostgreSQL
- **Custom script**: Lightweight, less robust, harder to debug

**Recommendation**: supervisord for production-grade process management

**Decision**: Proceed with supervisord unless user specifies otherwise.

---

### Q2: PostgreSQL in Container vs External
**Question**: Should PostgreSQL run inside the unified container or remain a separate Podman container?

**Trade-offs**:
- **Inside Container**: Simpler single-container deployment, harder to manage data persistence
- **Separate Container**: Better for production, requires bridge networking

**Recommendation**: Separate PostgreSQL container for development, unified for production builds

**Decision**: Use **separate PostgreSQL container** for better data management and align with common patterns. Unified Dockerfile will only contain Gateway + Ergo IRC.

---

### Q3: Monorepo Tooling
**Question**: Should we use NPM Workspaces (v1 approach) or upgrade to pnpm/Turborepo for better monorepo management?

**Options**:
- **NPM Workspaces**: Simple, already in use, slower builds
- **pnpm Workspaces**: Faster, better disk usage, requires pnpm install
- **Turborepo**: Best caching, fastest builds, adds complexity

**Recommendation**: Stick with NPM Workspaces for simplicity unless performance becomes an issue

**Decision**: Continue with NPM Workspaces to minimize migration risk.

---

### Q4: TypeScript Project References
**Question**: Should we use TypeScript Project References for faster incremental builds across packages?

**Benefit**: Faster builds, better IDE support, enforced package boundaries

**Cost**: More complex tsconfig.json setup, requires build step for dev

**Recommendation**: Implement project references for better DX

**Decision**: Yes, implement TypeScript Project References.

---

## Assumptions & Constraints

### Assumptions
1. User has Podman installed and rootless mode configured on Windows
2. Node.js v20+ is available for local development
3. All v1 functionality documented in `PROJECT_MANIFEST.md` is authoritative
4. Glassmorphism design in v1 `index.css` is the target aesthetic
5. Ergo IRCd version is compatible with documented configuration

### Constraints
1. Must use Podman (not Docker) for all container orchestration
2. Must use Tailwind CSS v4 (not v3 or earlier)
3. Must use React 19 with latest features
4. Must maintain backward compatibility with v1 database schema
5. Cannot introduce breaking changes to `window.ironcord` IPC API

## References

- **v1 Codebase**: `ReferenceProject/` directory
- **Project Manifest**: `ReferenceProject/PROJECT_MANIFEST.md`
- **Ergo Documentation**: https://ergo.chat/
- **IRCv3 Specs**: https://ircv3.net/
- **Podman Compose**: https://github.com/containers/podman-compose
- **Tailwind CSS v4**: https://tailwindcss.com/

---

**Document Status**: Draft for Review  
**Last Updated**: 2026-02-12  
**Author**: IronCord-GPT (Senior Systems Architect)
