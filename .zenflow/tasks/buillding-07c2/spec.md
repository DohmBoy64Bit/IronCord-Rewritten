# IronCord v2 Modular Rewrite - Technical Specification

## 1. Executive Summary

This specification outlines the technical approach for transforming IronCord v1 (located in `ReferenceProject/`) from a monolithic structure into a modular monorepo architecture (v2). The rewrite maintains 100% feature parity while establishing strict architectural boundaries, consolidating infrastructure into Podman-based orchestration, and enforcing "Industrial Grade" standards: DRY principles, strict TypeScript typing, and elimination of "God Files" (300-line maximum per file).

**Critical Constraint**: All implementation phases require **real-world testing with zero mocked services** and **100% test pass rate** before progression.

---

## 2. Technical Context

### 2.1 Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Frontend** | React | 19.x | Latest features including concurrent rendering |
| **Desktop Runtime** | Electron | 40.x | Electron Forge for build/packaging |
| **Styling** | Tailwind CSS | 4.x | Glassmorphism design system |
| **State Management** | Zustand | 5.x | Lightweight global state |
| **Backend Runtime** | Node.js | 20+ LTS | TypeScript with strict mode |
| **API Framework** | Express | 5.x | REST endpoints |
| **WebSocket** | Socket.IO | 4.x | Real-time bidirectional communication |
| **IRC Server** | Ergo IRCd | latest | IRCv3 extensions (SASL, CHATHISTORY) |
| **Database** | PostgreSQL | 15 | Alpine image for containers |
| **Orchestration** | Podman Compose | latest | Rootless-compatible |
| **Build System** | NPM Workspaces | NPM 10+ | Monorepo management |
| **Testing - Unit/Integration** | Vitest | 4.x | Fast unit/integration testing |
| **Testing - E2E** | Playwright | 1.x | Electron app testing |

### 2.2 Development Environment

- **OS Target**: Windows 11 (primary), cross-platform support via Podman
- **Container Runtime**: Podman (rootless mode) - NOT Docker
- **TypeScript**: Strict mode enabled, no `any` types permitted
- **Linting**: ESLint with TypeScript parser
- **Formatting**: Prettier (inherited from v1 config)

---

## 3. System Architecture

### 3.1 Modular Monorepo Structure

The v2 architecture enforces strict separation of concerns through package boundaries:

```
ironcord-v2/
├── packages/                    # Shared libraries (core logic)
│   ├── engine/                  # IRC protocol abstraction
│   │   ├── src/
│   │   │   ├── irc-client.ts           # Main IRCClient class
│   │   │   ├── protocol/               # Protocol parsing & formatting
│   │   │   │   ├── parser.ts           # IRC message parsing
│   │   │   │   ├── formatter.ts        # IRC command formatting
│   │   │   │   └── tags.ts             # IRCv3 message tags
│   │   │   ├── capabilities/           # IRCv3 capability modules
│   │   │   │   ├── sasl.ts             # SASL PLAIN authentication
│   │   │   │   ├── chathistory.ts      # CHATHISTORY implementation
│   │   │   │   └── batch.ts            # BATCH message handling
│   │   │   ├── connection/             # Connection management
│   │   │   │   ├── socket.ts           # TCP socket wrapper
│   │   │   │   └── reconnect.ts        # Reconnection logic
│   │   │   └── types.ts                # IRC-specific types
│   │   ├── tests/
│   │   │   └── integration/            # Tests against real Ergo IRC
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── db/                      # Database service layer
│   │   ├── src/
│   │   │   ├── database.service.ts     # Connection pool manager
│   │   │   ├── repositories/           # Data access layer
│   │   │   │   ├── user.repository.ts
│   │   │   │   ├── guild.repository.ts
│   │   │   │   ├── channel.repository.ts
│   │   │   │   └── member.repository.ts
│   │   │   ├── migrations/             # Schema versioning
│   │   │   │   └── 001_initial_schema.sql
│   │   │   └── types.ts                # Database-specific types
│   │   ├── tests/
│   │   │   └── integration/            # Tests against real PostgreSQL
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                  # Cross-cutting utilities
│       ├── src/
│       │   ├── types/                  # Shared TypeScript types
│       │   │   ├── user.ts
│       │   │   ├── guild.ts
│       │   │   ├── channel.ts
│       │   │   ├── message.ts
│       │   │   └── presence.ts
│       │   ├── utils/                  # Utility functions
│       │   │   ├── logger.ts           # Logging utility
│       │   │   ├── validators.ts       # Input validation
│       │   │   └── formatters.ts       # Data formatting
│       │   └── constants.ts            # Global constants
│       ├── package.json
│       └── tsconfig.json
│
├── apps/                        # Deployable applications
│   ├── gateway/                 # Backend API + WebSocket server
│   │   ├── src/
│   │   │   ├── index.ts                # Application entry point
│   │   │   ├── server.ts               # Express app setup
│   │   │   ├── api/
│   │   │   │   ├── auth/               # Authentication routes
│   │   │   │   │   ├── register.ts     # POST /auth/register
│   │   │   │   │   ├── login.ts        # POST /auth/login
│   │   │   │   │   └── index.ts        # Router aggregation
│   │   │   │   ├── guilds/             # Guild management routes
│   │   │   │   │   ├── list.ts         # GET /guilds/mine
│   │   │   │   │   ├── create.ts       # POST /guilds
│   │   │   │   │   ├── channels.ts     # Guild channel operations
│   │   │   │   │   └── index.ts
│   │   │   │   └── websocket/          # Socket.IO server
│   │   │   │       ├── server.ts       # WebSocket server class
│   │   │   │       ├── handlers/       # Event handlers
│   │   │   │       │   ├── connection.ts
│   │   │   │       │   ├── irc-bridge.ts
│   │   │   │       │   ├── messages.ts
│   │   │   │       │   └── presence.ts
│   │   │   │       └── middleware/     # Socket.IO middleware
│   │   │   │           └── auth.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts  # JWT verification
│   │   │   │   ├── error.middleware.ts # Error handling
│   │   │   │   └── validation.middleware.ts
│   │   │   └── config/
│   │   │       └── env.ts              # Environment configuration
│   │   ├── tests/
│   │   │   ├── integration/            # API integration tests
│   │   │   └── setup.ts                # Test environment setup
│   │   ├── Dockerfile                  # Multi-stage build
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── client/                  # Electron desktop application
│       ├── src/
│       │   ├── main/                   # Electron main process
│       │   │   ├── index.ts            # Main process entry
│       │   │   ├── window.ts           # Window management
│       │   │   └── ipc-handlers.ts     # IPC request handlers
│       │   ├── preload/
│       │   │   └── preload.ts          # Preload script (window.ironcord)
│       │   ├── renderer/               # React application
│       │   │   ├── App.tsx             # Root component
│       │   │   ├── store/              # Zustand stores
│       │   │   │   ├── auth.store.ts
│       │   │   │   ├── guild.store.ts
│       │   │   │   ├── message.store.ts
│       │   │   │   └── presence.store.ts
│       │   │   ├── components/         # React components
│       │   │   │   ├── layout/
│       │   │   │   │   ├── TitleBar.tsx
│       │   │   │   │   ├── Sidebar.tsx
│       │   │   │   │   └── ChannelList.tsx
│       │   │   │   ├── chat/
│       │   │   │   │   ├── Chat.tsx
│       │   │   │   │   ├── MessageList.tsx
│       │   │   │   │   ├── MessageInput.tsx
│       │   │   │   │   └── MemberPanel.tsx
│       │   │   │   ├── auth/
│       │   │   │   │   ├── Login.tsx
│       │   │   │   │   └── Register.tsx
│       │   │   │   └── modals/
│       │   │   │       ├── CreateGuildModal.tsx
│       │   │   │       └── ServerSettingsModal.tsx
│       │   │   └── styles/
│       │   │       └── index.css        # Glassmorphism styles
│       │   └── types/
│       │       └── ironcord.d.ts        # window.ironcord types
│       ├── tests/
│       │   ├── e2e/                     # Playwright E2E tests
│       │   └── unit/                    # Component unit tests
│       ├── forge.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── infra/                       # Infrastructure configuration
│   ├── podman/
│   │   ├── Dockerfile.unified          # Gateway + Ergo IRC unified image
│   │   ├── supervisord.conf            # Process manager config
│   │   └── ergo.yaml                   # Ergo IRC configuration
│   └── scripts/
│       ├── clean_build.ps1             # Podman environment reset
│       └── test-services.ps1           # Start test containers
│
├── tests/                       # Root-level test infrastructure
│   ├── setup-real-services.ts          # Podman container orchestration
│   ├── teardown-real-services.ts       # Container cleanup
│   └── global-setup.ts                 # Playwright global setup
│
├── podman-compose.yml           # Podman orchestration
├── package.json                 # Monorepo root
├── tsconfig.json                # Root TypeScript config
├── tsconfig.base.json           # Shared TypeScript settings
├── playwright.config.ts         # E2E test configuration
└── .gitignore
```

### 3.2 Package Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                      Dependency Flow                        │
└─────────────────────────────────────────────────────────────┘

apps/client (Electron)
  └─> @ironcord/shared (types only)

apps/gateway (Express + Socket.IO)
  ├─> @ironcord/engine (IRC client)
  ├─> @ironcord/db (database access)
  └─> @ironcord/shared (types + utils)

packages/engine
  └─> @ironcord/shared (types + utils)

packages/db
  └─> @ironcord/shared (types + utils)

packages/shared
  └─> (no dependencies - foundation layer)
```

**Rules**:
- Client MUST NOT depend on `engine` or `db` (communicates via Gateway API)
- Gateway is the ONLY consumer of `engine` and `db`
- Packages MUST NOT have circular dependencies
- All inter-package dependencies via NPM workspace aliases (`@ironcord/*`)

---

## 4. Component-Level Design

### 4.1 `/packages/engine` - IRC Protocol Layer

**Purpose**: Encapsulate all IRC protocol logic extracted from `ReferenceProject/apps/gateway/src/irc-client.ts` (469 lines → split into <300 line modules).

**Responsibilities**:
- TCP socket connection management
- IRCv3 capability negotiation (CAP LS 302, CAP REQ, CAP END)
- SASL PLAIN authentication flow
- CHATHISTORY message retrieval
- BATCH message handling
- IRC command parsing and formatting
- Event emission for gateway consumption

**Key Classes & Modules**:

1. **`IRCClient` (main export)**
   - Entry point class (EventEmitter)
   - Delegates to specialized modules
   - Methods: `connect()`, `disconnect()`, `send()`, `join()`, `part()`, `sendMessage()`, `requestHistory()`
   - Events: `connected`, `disconnected`, `registered`, `message`, `history`, `members`, `error`

2. **`protocol/parser.ts`**
   - Parse raw IRC lines into structured messages
   - Extract prefix, command, params, trailing
   - Parse IRCv3 message tags (`@msgid=abc;time=123 :nick!user@host PRIVMSG #channel :message`)

3. **`protocol/formatter.ts`**
   - Format outgoing IRC commands
   - Handle PRIVMSG, JOIN, PART, NICK, USER, etc.
   - Escape special characters

4. **`capabilities/sasl.ts`**
   - SASL PLAIN authentication state machine
   - Base64 encoding of credentials
   - Handle AUTHENTICATE command sequence

5. **`capabilities/chathistory.ts`**
   - `CHATHISTORY LATEST` command formatting
   - Coordinate with BATCH handler
   - History message aggregation

6. **`capabilities/batch.ts`**
   - Track BATCH start/end
   - Aggregate messages within batch
   - Emit complete history batches

7. **`connection/reconnect.ts`**
   - Exponential backoff logic
   - Retry state management
   - Reconnection event emissions

**Type Definitions** (`types.ts`):
```typescript
export interface IRCConfig {
  host: string;
  port: number;
  nick: string;
  username: string;
  realname: string;
  password?: string; // SASL password
}

export interface IRCMessage {
  raw: string;
  tags?: Record<string, string>; // IRCv3 tags
  prefix?: string;
  command: string;
  params: string[];
  trailing?: string;
}

export interface ReconnectOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
}
```

**Testing Requirements**:
- Integration tests against **real Ergo IRC server** (no mocks)
- Test SASL authentication with valid/invalid credentials
- Test CHATHISTORY retrieval of pre-populated messages
- Test reconnection logic with simulated network interruptions
- Test CAP negotiation with actual server responses
- **Pass Criteria**: 100% test pass rate, coverage >80%

---

### 4.2 `/packages/db` - Database Service Layer

**Purpose**: Encapsulate all PostgreSQL interactions extracted from `ReferenceProject/apps/gateway/src/services/db.service.ts` and related query logic.

**Responsibilities**:
- Connection pool management
- Schema initialization and migrations
- Repository pattern for data access
- Transaction management
- Query builders for type-safe database operations

**Key Classes & Modules**:

1. **`DatabaseService` (main export)**
   - Singleton connection pool
   - Schema initialization
   - Health checks
   - Methods: `query()`, `initializeSchema()`, `close()`

2. **`repositories/user.repository.ts`**
   - `createUser(email, passwordHash, ircNick)`
   - `findByEmail(email)`
   - `findByIrcNick(nick)`
   - `findById(id)`

3. **`repositories/guild.repository.ts`**
   - `createGuild(name, ownerId, ircPrefix)`
   - `findById(id)`
   - `findByOwnerId(userId)`
   - `findByMemberId(userId)` - guilds user is a member of

4. **`repositories/channel.repository.ts`**
   - `createChannel(guildId, name, ircChannelName)`
   - `findByGuildId(guildId)`
   - `findByIrcChannelName(ircName)`

5. **`repositories/member.repository.ts`**
   - `addMember(guildId, userId)`
   - `removeMember(guildId, userId)`
   - `isMember(guildId, userId)`

6. **`migrations/` directory**
   - SQL migration files
   - `001_initial_schema.sql` - current schema from v1
   - Future migrations numbered sequentially

**Type Definitions** (`types.ts`):
```typescript
export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  irc_nick: string;
  avatar_url?: string;
  created_at: Date;
}

export interface DbGuild {
  id: string;
  name: string;
  owner_id: string;
  irc_namespace_prefix: string;
  created_at: Date;
}

export interface DbChannel {
  id: string;
  guild_id: string;
  name: string;
  irc_channel_name: string;
  topic?: string;
  created_at: Date;
}
```

**Schema Management**:
- Copy existing schema from `ReferenceProject/apps/gateway/src/db/schema.sql`
- Add indexes for `users.irc_nick` and `channels.irc_channel_name`
- Future migration system for schema evolution

**Testing Requirements**:
- Integration tests against **real PostgreSQL instance** (no mocks)
- Test schema initialization creates all tables correctly
- Test all repository CRUD operations
- Test constraint violations (unique email, foreign keys)
- Test transaction rollback scenarios
- **Pass Criteria**: 100% test pass rate, coverage >80%

---

### 4.3 `/packages/shared` - Common Utilities

**Purpose**: Shared types, utilities, and constants used across all packages and apps.

**Responsibilities**:
- TypeScript type definitions (User, Guild, Channel, Message)
- Logger utility (file + console logging)
- Input validators (email, password strength)
- Data formatters (dates, usernames)
- Global constants

**Key Modules**:

1. **`types/user.ts`**
   - `User`, `UserPresence`, `AuthCredentials`

2. **`types/guild.ts`**
   - `Guild`, `CreateGuildRequest`

3. **`types/channel.ts`**
   - `Channel`, `CreateChannelRequest`

4. **`types/message.ts`**
   - `Message`, `MessageTags`, `HistoryRequest`

5. **`utils/logger.ts`**
   - Universal logger for both Node.js and Electron
   - Log levels: `info`, `warn`, `error`, `debug`
   - File output support

6. **`utils/validators.ts`**
   - `validateEmail(email: string): boolean`
   - `validatePassword(password: string): { valid: boolean; errors: string[] }`
   - `sanitizeNickname(nick: string): string`

**Testing Requirements**:
- Unit tests for all validators
- Unit tests for formatters
- Logger output verification
- **Pass Criteria**: 100% test pass rate, coverage >90%

---

### 4.4 `/apps/gateway` - Backend API Server

**Purpose**: Express REST API + Socket.IO server that bridges the client with IRC and database.

**Responsibilities**:
- REST API endpoints (auth, guilds, channels)
- JWT authentication
- Socket.IO WebSocket server
- IRC connection management per user session
- Real-time event broadcasting

**Key Modules**:

1. **`server.ts`** - Express app configuration
   - CORS setup
   - JSON body parsing
   - Route registration
   - Error middleware

2. **`api/auth/register.ts`** - `POST /auth/register`
   - Validate email/password
   - Hash password (bcrypt, 10 rounds)
   - Generate IRC nick from email
   - Insert user into database
   - Return JWT token

3. **`api/auth/login.ts`** - `POST /auth/login`
   - Validate credentials
   - Compare password hash
   - Generate JWT token
   - Return user data + token

4. **`api/guilds/create.ts`** - `POST /guilds`
   - Require JWT authentication
   - Generate IRC namespace prefix
   - Create guild, add owner as member
   - Create default #general channel
   - Emit `irc:immediate-join` event

5. **`api/guilds/list.ts`** - `GET /guilds/mine`
   - Require JWT authentication
   - Return guilds where user is a member

6. **`api/websocket/server.ts`** - Socket.IO server
   - JWT-based Socket.IO authentication middleware
   - Manage per-user IRC client instances
   - Bridge client events to IRC commands
   - Broadcast IRC events to clients

7. **`api/websocket/handlers/irc-bridge.ts`**
   - `irc:connect` - instantiate IRCClient from `@ironcord/engine`
   - `irc:message` - forward to IRCClient.sendMessage()
   - `irc:join` - forward to IRCClient.join()
   - `irc:history` - forward to IRCClient.requestHistory()
   - `irc:presence` - forward to IRCClient.setAway()

8. **`middleware/auth.middleware.ts`**
   - JWT verification
   - Extract user ID from token
   - Attach user to request object

**Environment Configuration** (`config/env.ts`):
```typescript
export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'ironcord',
    password: process.env.DB_PASSWORD || 'ironcord_password',
    name: process.env.DB_NAME || 'ironcord',
  },
  irc: {
    host: process.env.IRC_HOST || 'localhost',
    port: parseInt(process.env.IRC_PORT || '6667'),
  },
};
```

**Testing Requirements**:
- Integration tests for all REST endpoints with **real database**
- Integration tests for Socket.IO events with **real IRC server**
- Test auth flow: register → JWT → Socket.IO auth → IRC SASL
- Test guild creation → database + IRC channel creation
- Test message send → IRC PRIVMSG → database persistence
- **Pass Criteria**: 100% test pass rate, coverage >80%

---

### 4.5 `/apps/client` - Electron Desktop Application

**Purpose**: Desktop UI for IronCord built with Electron + React.

**Responsibilities**:
- Window management (Electron main process)
- IPC bridge (`window.ironcord`)
- React UI rendering
- Zustand state management
- Socket.IO connection to gateway
- Glassmorphism design system

**Key Modules**:

1. **`main/index.ts`** - Electron main process
   - Create BrowserWindow
   - Load renderer (Vite dev server or production bundle)
   - Manage Socket.IO connection
   - Register IPC handlers

2. **`main/ipc-handlers.ts`** - IPC handlers
   - `handle('register')` - call Gateway REST API
   - `handle('login')` - call Gateway REST API
   - `handle('connectIRC')` - emit Socket.IO event
   - `handle('sendMessage')` - emit Socket.IO event
   - `handle('getMyGuilds')` - call Gateway REST API
   - `handle('createGuild')` - call Gateway REST API

3. **`preload/preload.ts`** - Preload script
   - Expose `window.ironcord` API to renderer
   - Methods: `register()`, `login()`, `connectIRC()`, `sendMessage()`, etc.
   - Event listeners: `onIRCMessage()`, `onIRCHistory()`, etc.

4. **`renderer/store/auth.store.ts`** - Zustand store
   - User authentication state
   - JWT token storage
   - Login/logout actions

5. **`renderer/store/guild.store.ts`** - Zustand store
   - Guild and channel lists
   - Active guild/channel selection
   - Guild creation actions

6. **`renderer/store/message.store.ts`** - Zustand store
   - Message history per channel
   - New message handling
   - History loading state

7. **`renderer/components/layout/Sidebar.tsx`**
   - Guild icons navigation
   - Create guild button
   - Preserve v1 glassmorphism design

8. **`renderer/components/chat/Chat.tsx`**
   - Message list rendering
   - Message input
   - Member panel
   - Search functionality

9. **`renderer/styles/index.css`**
   - Import v1 glassmorphism styles
   - Tailwind CSS v4 setup
   - Custom scrollbars

**IPC API Contract** (`types/ironcord.d.ts`):
```typescript
export interface IronCordAPI {
  // Auth
  register(data: { email: string; password: string }): Promise<{ user: User; token: string }>;
  login(credentials: { email: string; password: string }): Promise<{ user: User; token: string }>;
  
  // IRC
  connectIRC(userId: string, config: IRCConfig): void;
  sendMessage(channel: string, message: string): void;
  joinChannel(channel: string): void;
  requestHistory(channel: string, limit: number): void;
  setPresence(status: 'online' | 'away' | 'offline'): void;
  
  // Guilds
  getMyGuilds(): Promise<Guild[]>;
  getChannels(guildId: string): Promise<Channel[]>;
  createGuild(name: string): Promise<Guild>;
  createChannel(guildId: string, name: string): Promise<Channel>;
  
  // Event Listeners
  onIRCRegistered(callback: () => void): void;
  onIRCMessage(callback: (message: Message) => void): void;
  onIRCHistory(callback: (messages: Message[]) => void): void;
  onIRCMembers(callback: (channel: string, members: string[]) => void): void;
  onIRCError(callback: (error: string) => void): void;
}

declare global {
  interface Window {
    ironcord: IronCordAPI;
  }
}
```

**Testing Requirements**:
- Playwright E2E tests against **running Electron app**
- Test user registration → login → guild creation → messaging
- Test history retrieval on channel join
- Test presence updates
- Test reconnection on IRC disconnect
- **Pass Criteria**: 100% E2E test pass rate

---

## 5. Infrastructure Design

### 5.1 Unified Dockerfile Architecture

**Goal**: Consolidate Gateway + Ergo IRC into a single container image (PostgreSQL remains separate).

**Multi-Stage Dockerfile** (`infra/podman/Dockerfile.unified`):

```dockerfile
# Stage 1: Build Gateway (TypeScript → JavaScript)
FROM node:20-alpine AS gateway-builder
WORKDIR /build
COPY package.json package-lock.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/gateway/ ./apps/gateway/
RUN npm ci --workspace=@ironcord/gateway --workspace=@ironcord/engine --workspace=@ironcord/db --workspace=@ironcord/shared
RUN npm run build --workspace=@ironcord/gateway

# Stage 2: Production Runtime Image
FROM node:20-alpine
RUN apk add --no-cache supervisor

# Copy Gateway Production Artifacts
WORKDIR /app/gateway
COPY --from=gateway-builder /build/apps/gateway/dist ./dist
COPY --from=gateway-builder /build/apps/gateway/package.json ./
COPY --from=gateway-builder /build/node_modules ./node_modules

# Install Ergo IRC Server
RUN apk add --no-cache ca-certificates wget && \
    wget -O /tmp/ergo.tar.gz https://github.com/ergochat/ergo/releases/download/v2.14.0/ergo-2.14.0-linux-x86_64.tar.gz && \
    tar -xzf /tmp/ergo.tar.gz -C /usr/local/bin && \
    rm /tmp/ergo.tar.gz && \
    mkdir -p /etc/ergo /var/lib/ergo

# Copy Ergo Configuration
COPY infra/podman/ergo.yaml /etc/ergo/ircd.yaml

# Copy Supervisor Configuration
COPY infra/podman/supervisord.conf /etc/supervisord.conf

# Expose Ports
EXPOSE 3000 6667

# Health Check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
```

**Supervisor Configuration** (`infra/podman/supervisord.conf`):

```ini
[supervisord]
nodaemon=true
logfile=/dev/null
logfile_maxbytes=0

[program:ergo]
command=/usr/local/bin/ergo run --conf /etc/ergo/ircd.yaml
stdout_logfile=/dev/fd/1
stdout_logfile_maxbytes=0
stderr_logfile=/dev/fd/2
stderr_logfile_maxbytes=0
autorestart=true
priority=10

[program:gateway]
command=node /app/gateway/dist/index.js
stdout_logfile=/dev/fd/1
stdout_logfile_maxbytes=0
stderr_logfile=/dev/fd/2
stderr_logfile_maxbytes=0
autorestart=true
priority=20
environment=NODE_ENV="production",PORT="3000",IRC_HOST="localhost",IRC_PORT="6667"
```

**Ergo IRC Configuration** (`infra/podman/ergo.yaml`):

```yaml
network:
  name: IronCord-Net

server:
  name: irc.ironcord.local
  listeners:
    ":6667":
      tls: false

accounts:
  authentication-enabled: true
  registration:
    enabled: true
    allow-unconfirmed-sessions: true
  login-throttling:
    enabled: false

history:
  enabled: true
  channel-length: 1000
  client-length: 100
  chathistory-maxmessages: 1000

channels:
  registration:
    enabled: true

datastore:
  path: /var/lib/ergo/ircd.db
```

### 5.2 Podman Compose Orchestration

**`podman-compose.yml`** (Project Root):

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: infra/podman/Dockerfile.unified
    image: ironcord-app:v2
    container_name: ironcord-app
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=db
      - DB_PORT=5432
      - DB_USER=ironcord
      - DB_PASSWORD=ironcord_password
      - DB_NAME=ironcord
      - IRC_HOST=localhost
      - IRC_PORT=6667
      - JWT_SECRET=ironcord_secret_key_change_me
      - CORS_ORIGIN=http://localhost:5173
    ports:
      - "3000:3000"   # Gateway API
      - "6667:6667"   # IRC Server
    depends_on:
      db:
        condition: service_healthy
    networks:
      - ironcord-net
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    container_name: ironcord-db
    environment:
      - POSTGRES_USER=ironcord
      - POSTGRES_PASSWORD=ironcord_password
      - POSTGRES_DB=ironcord
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - ironcord-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ironcord"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

networks:
  ironcord-net:
    driver: bridge

volumes:
  db-data:
```

### 5.3 Podman Build & Deployment Scripts

**`infra/scripts/clean_build.ps1`** (PowerShell):

```powershell
#!/usr/bin/env pwsh
# Clean Podman environment and rebuild from scratch

Write-Host "🧹 Cleaning Podman environment..." -ForegroundColor Cyan

# Stop and remove all containers
podman compose down --volumes
podman system prune -af --volumes

Write-Host "🔨 Building unified image..." -ForegroundColor Cyan
podman compose build --no-cache

Write-Host "🚀 Starting services..." -ForegroundColor Green
podman compose up -d

Write-Host "⏳ Waiting for health checks..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

podman compose ps

Write-Host "✅ Build complete!" -ForegroundColor Green
```

### 5.4 Testing Infrastructure

**`tests/setup-real-services.ts`** - Start Podman containers for testing:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function setupTestServices() {
  console.log('Starting test services...');
  
  // Start containers in detached mode
  await execAsync('podman compose -f podman-compose.test.yml up -d');
  
  // Wait for health checks
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  console.log('Test services ready');
}

export async function teardownTestServices() {
  console.log('Stopping test services...');
  await execAsync('podman compose -f podman-compose.test.yml down --volumes');
  console.log('Test services stopped');
}
```

**`podman-compose.test.yml`** - Test-specific configuration:

```yaml
version: '3.8'

services:
  app-test:
    build:
      context: .
      dockerfile: infra/podman/Dockerfile.unified
    environment:
      - NODE_ENV=test
      - PORT=3001
      - DB_HOST=db-test
      - DB_PORT=5432
      - DB_USER=ironcord_test
      - DB_PASSWORD=test_password
      - DB_NAME=ironcord_test
      - IRC_HOST=localhost
      - IRC_PORT=6667
      - JWT_SECRET=test_secret
    ports:
      - "3001:3001"
      - "6668:6667"
    depends_on:
      db-test:
        condition: service_healthy
    networks:
      - ironcord-test-net

  db-test:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=ironcord_test
      - POSTGRES_PASSWORD=test_password
      - POSTGRES_DB=ironcord_test
    ports:
      - "5433:5432"
    networks:
      - ironcord-test-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ironcord_test"]
      interval: 3s
      timeout: 3s
      retries: 10

networks:
  ironcord-test-net:
    driver: bridge
```

---

## 6. Data Models & API Contracts

### 6.1 Database Schema (PostgreSQL)

Migrate existing schema from `ReferenceProject/apps/gateway/src/db/schema.sql` with added indexes:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    irc_nick VARCHAR(32) UNIQUE NOT NULL,
    avatar_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_irc_nick ON users(irc_nick);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Guilds Table
CREATE TABLE IF NOT EXISTS guilds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    irc_namespace_prefix VARCHAR(32) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guilds_owner ON guilds(owner_id);

-- Channels Table
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    irc_channel_name VARCHAR(64) NOT NULL,
    topic TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, name)
);

CREATE INDEX IF NOT EXISTS idx_channels_guild ON channels(guild_id);
CREATE INDEX IF NOT EXISTS idx_channels_irc_name ON channels(irc_channel_name);

-- Guild Members
CREATE TABLE IF NOT EXISTS guild_members (
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_members_user ON guild_members(user_id);
```

### 6.2 REST API Endpoints

**Authentication**:

```
POST /auth/register
Request:
  {
    "email": "user@example.com",
    "password": "SecurePass123!"
  }
Response (200):
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "irc_nick": "user_example",
      "avatar_url": null,
      "created_at": "2026-02-12T21:00:00Z"
    },
    "token": "jwt_token_here"
  }

POST /auth/login
Request:
  {
    "email": "user@example.com",
    "password": "SecurePass123!"
  }
Response (200):
  {
    "user": { ... },
    "token": "jwt_token_here"
  }
```

**Guild Management** (requires JWT in `Authorization: Bearer <token>` header):

```
GET /guilds/mine
Response (200):
  [
    {
      "id": "guild-uuid",
      "name": "Gaming Guild",
      "owner_id": "user-uuid",
      "irc_namespace_prefix": "&gaming-",
      "created_at": "2026-02-12T21:00:00Z"
    }
  ]

POST /guilds
Request:
  {
    "name": "New Guild"
  }
Response (201):
  {
    "guild": { ... },
    "defaultChannel": {
      "id": "channel-uuid",
      "name": "general",
      "irc_channel_name": "&newguild-general"
    }
  }

GET /guilds/:guildId/channels
Response (200):
  [
    {
      "id": "channel-uuid",
      "guild_id": "guild-uuid",
      "name": "general",
      "irc_channel_name": "&guild-general",
      "topic": "General discussion"
    }
  ]

POST /guilds/:guildId/channels
Request:
  {
    "name": "off-topic"
  }
Response (201):
  {
    "channel": { ... }
  }
```

### 6.3 WebSocket Events (Socket.IO)

**Client → Server**:

```typescript
// Connect to IRC
socket.emit('irc:connect', {
  config: {
    nick: 'user_nick',
    username: 'username',
    gecos: 'Real Name',
    server: 'localhost',
    port: 6667,
    password: 'sasl_password'
  }
});

// Send message
socket.emit('irc:message', {
  channel: '&guild-general',
  message: 'Hello world!'
});

// Join channel
socket.emit('irc:join', {
  channel: '&guild-general'
});

// Request history
socket.emit('irc:history', {
  channel: '&guild-general',
  limit: 100
});

// Update presence
socket.emit('irc:presence', {
  status: 'away' | 'online'
});
```

**Server → Client**:

```typescript
// IRC registered
socket.on('irc:registered', () => {
  console.log('IRC registration complete');
});

// New message
socket.on('irc:message', (message) => {
  // message: { id, author, channel, content, timestamp }
});

// History batch
socket.on('irc:history', (messages) => {
  // messages: Array<Message>
});

// Channel members
socket.on('irc:members', (data) => {
  // data: { channel, members: string[] }
});

// Error
socket.on('irc:error', (error) => {
  // error: { message: string }
});
```

---

## 7. Delivery Phases

### Phase 1: Package Extraction & Foundation (Week 1)

**Objective**: Create modular package structure and migrate core logic.

**Tasks**:
1. Create monorepo structure (`/packages`, `/apps`)
2. Extract `@ironcord/shared` package
   - Copy types from v1
   - Copy logger utility
   - Create validators, formatters
3. Extract `@ironcord/engine` package
   - Split `irc-client.ts` into modules (<300 lines each)
   - Create protocol parser/formatter
   - Create SASL, CHATHISTORY, BATCH modules
   - Create reconnection logic
4. Extract `@ironcord/db` package
   - Migrate `db.service.ts`
   - Create repository pattern implementations
   - Migrate schema to migrations folder
5. Setup TypeScript Project References
6. Configure NPM Workspaces

**Testing**:
- ✅ Unit tests for `@ironcord/shared` utilities (100% pass)
- ✅ Integration tests for `@ironcord/engine` with **real Ergo IRC** (100% pass)
- ✅ Integration tests for `@ironcord/db` with **real PostgreSQL** (100% pass)
- ✅ Test coverage >80% for all packages

**Deliverables**:
- Working packages with explicit exports
- Passing test suites (no mocks)
- Documentation in each package README

**Blocking**: Cannot proceed to Phase 2 until ALL tests pass.

---

### Phase 2: Infrastructure Unification (Week 2)

**Objective**: Consolidate Docker → Podman with unified container.

**Tasks**:
1. Design multi-stage `Dockerfile.unified`
   - Gateway build stage
   - Ergo installation
   - Supervisor setup
2. Create `supervisord.conf`
3. Migrate Ergo configuration to `infra/podman/ergo.yaml`
4. Create `podman-compose.yml`
   - Unified app container
   - Separate PostgreSQL container
5. Update `clean_build.ps1` for Podman
6. Create test infrastructure scripts
   - `tests/setup-real-services.ts`
   - `podman-compose.test.yml`
7. Add health checks

**Testing**:
- ✅ Integration test: Container startup within 30 seconds
- ✅ Health check validation (PostgreSQL, Ergo, Gateway all healthy)
- ✅ Service connectivity test (Gateway → PostgreSQL, Gateway → Ergo)
- ✅ Test service orchestration scripts
- ✅ All tests passing (100% pass rate)

**Deliverables**:
- Working Podman Compose setup
- Automated build scripts
- Test infrastructure ready

**Blocking**: Cannot proceed to Phase 3 until infrastructure tests pass.

---

### Phase 3: Gateway Modernization (Week 3)

**Objective**: Refactor gateway to use extracted packages.

**Tasks**:
1. Update `apps/gateway` to import from `@ironcord/*` packages
2. Split API routes into modular files (<300 lines)
   - Separate auth routes
   - Separate guild routes
3. Refactor WebSocket server
   - Split into handler modules
   - Use `@ironcord/engine` for IRC
4. Add comprehensive error handling
5. Add request/response validation
6. Implement middleware (auth, error, validation)
7. Add environment configuration module
8. Remove old `irc-client.ts` and `db.service.ts` from gateway

**Testing**:
- ✅ Integration tests for all REST endpoints with **real database**
- ✅ Integration tests for WebSocket events with **real IRC server**
- ✅ Test auth flow: register → JWT → Socket.IO auth → IRC SASL
- ✅ Test guild creation: API → DB → IRC channel creation
- ✅ Test message flow: client → WebSocket → IRC PRIVMSG → DB
- ✅ All tests passing (100% pass rate)
- ✅ Test coverage >80%

**Deliverables**:
- Fully modular gateway
- No files >300 lines
- Passing integration test suite

**Blocking**: Cannot proceed to Phase 4 until gateway tests pass.

---

### Phase 4: Client Refinement (Week 4)

**Objective**: Update Electron client to use shared types and improve UX.

**Tasks**:
1. Update imports to use `@ironcord/shared` types
2. Verify glassmorphism styles from v1
3. Implement client-side error boundaries
4. Enhance IPC type safety
5. Add loading states for async operations
6. Improve error messages in UI
7. Test client against v2 gateway

**Testing**:
- ✅ Playwright E2E tests for full user flows
- ✅ Test user registration and login through UI
- ✅ Test guild creation and channel navigation
- ✅ Test message send/receive with real IRC backend
- ✅ Test history retrieval on channel join
- ✅ Test presence updates
- ✅ Test reconnection resilience (kill IRC server → auto-reconnect)
- ✅ All E2E tests passing (100% pass rate)

**Deliverables**:
- Polished Electron client
- Full E2E test coverage
- No regression from v1 UI

**Blocking**: Cannot proceed to Phase 5 until E2E tests pass.

---

### Phase 5: Final Validation & Optimization (Week 5)

**Objective**: Comprehensive testing and performance validation.

**Tasks**:
1. Run full test suite (unit + integration + E2E)
2. Performance testing
   - Measure startup time (<10s requirement)
   - Measure message latency (<100ms requirement)
   - Measure history load time (<500ms for 100 messages)
3. Stress testing
   - 100+ concurrent users
   - 1000+ messages
4. Reconnection resilience testing
   - Kill/restart IRC server
   - Kill/restart database
   - Verify auto-reconnect
5. Security audit
   - No hardcoded secrets
   - Password hashing validation
   - JWT security review
6. Code quality review
   - No files >300 lines
   - No `any` types
   - ESLint compliance

**Testing**:
- ✅ ALL unit tests passing (100%)
- ✅ ALL integration tests passing (100%)
- ✅ ALL E2E tests passing (100%)
- ✅ No flaky tests (10 consecutive full runs pass)
- ✅ Test coverage >80% across all packages
- ✅ Performance benchmarks met (NFR-2)

**Deliverables**:
- Production-ready v2
- Performance report
- Test coverage report
- Migration complete

**Blocking**: Project not complete until ALL validation passes.

---

## 8. Verification Approach

### 8.1 Test Strategy (CRITICAL REQUIREMENT)

**🚨 ZERO TOLERANCE FOR MOCKS - REAL SERVICES ONLY 🚨**

All tests MUST use real services:
- **Real PostgreSQL** (via Podman container)
- **Real Ergo IRC Server** (via Podman container)
- **Real Socket.IO connections** (no mocked sockets)
- **Real HTTP requests** (no mocked fetch)

### 8.2 Test Execution Workflow

**Before Each Test Suite**:
1. Run `tests/setup-real-services.ts` to start Podman containers
2. Wait for health checks to pass
3. Initialize database schema
4. Configure Ergo IRC server

**After Each Test Suite**:
1. Run `tests/teardown-real-services.ts` to stop containers
2. Clean up volumes
3. Reset state

### 8.3 Test Coverage Requirements

| Package/App | Unit Tests | Integration Tests | E2E Tests | Coverage Target |
|-------------|------------|-------------------|-----------|-----------------|
| `@ironcord/shared` | ✅ Required | ❌ N/A | ❌ N/A | >90% |
| `@ironcord/engine` | ✅ Required | ✅ Required (Real IRC) | ❌ N/A | >80% |
| `@ironcord/db` | ✅ Required | ✅ Required (Real DB) | ❌ N/A | >80% |
| `apps/gateway` | ✅ Required | ✅ Required (Real DB+IRC) | ❌ N/A | >80% |
| `apps/client` | ✅ Required | ❌ N/A | ✅ Required (Playwright) | >70% |

### 8.4 Lint & Type Check Commands

Root `package.json` scripts:

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm test --workspaces",
    "test:e2e": "playwright test",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit --project tsconfig.json"
  }
}
```

**Execution**:
```bash
npm run build         # Build all packages/apps
npm test              # Run all unit + integration tests
npm run test:e2e      # Run Playwright E2E tests
npm run lint          # Lint all TypeScript files
npm run typecheck     # Verify TypeScript types
```

### 8.5 Success Criteria Per Phase

Every phase MUST achieve:
1. ✅ All tests passing (100% success rate)
2. ✅ No flaky tests (10 consecutive runs pass)
3. ✅ Test coverage meets target
4. ✅ No TypeScript errors (`npm run typecheck`)
5. ✅ No ESLint errors (`npm run lint`)
6. ✅ All files <300 lines
7. ✅ No `any` types

**Failure = Immediate Stop**:
- If ANY test fails, implementation is INCOMPLETE
- Must fix root cause before proceeding
- Cannot skip or mark tests as "TODO"

---

## 9. Risk Mitigation

### 9.1 Known Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Podman rootless UID mapping issues** | High | Test on Windows early, document UID configuration |
| **Ergo IRC configuration incompatibility** | Medium | Copy v1 config exactly, validate SASL/CHATHISTORY |
| **TypeScript project references complexity** | Medium | Incremental setup, validate builds at each step |
| **Test flakiness with real services** | High | Robust health checks, retry logic, clean state |
| **Performance regression** | Medium | Baseline v1 metrics, compare in Phase 5 |
| **Breaking window.ironcord API** | Critical | Strict type contract, E2E tests as guardrails |

### 9.2 Rollback Plan

If Phase N fails validation:
1. Revert to Phase N-1 completion state
2. Analyze root cause
3. Adjust implementation approach
4. Re-attempt Phase N

---

## 10. Appendix

### 10.1 Reference Files (v1 Codebase)

Key files to study before implementation:

| File Path (v1) | Purpose | Lines | Notes |
|----------------|---------|-------|-------|
| `apps/gateway/src/irc-client.ts` | IRC protocol implementation | 469 | Must split into <300 line modules |
| `apps/gateway/src/services/db.service.ts` | Database service | 56 | Extract to `@ironcord/db` |
| `apps/gateway/src/api/websocket.ts` | Socket.IO server | ~150 | Refactor to use `@ironcord/engine` |
| `apps/gateway/src/api/auth.ts` | Auth routes | ~100 | Maintain JWT logic |
| `apps/gateway/src/api/guilds.ts` | Guild routes | ~150 | Split into modular files |
| `apps/client/src/main.ts` | Electron main process | ~200 | Keep IPC bridge intact |
| `apps/client/src/preload.ts` | Preload script | ~80 | Preserve `window.ironcord` API |
| `apps/client/src/App.tsx` | React root | ~150 | Maintain component structure |
| `apps/client/src/store.ts` | Zustand store | ~100 | Split into domain stores |
| `infra/ircd/ergo.conf` | Ergo config | ~30 | Copy to `ergo.yaml` |
| `ReferenceProject/docker-compose.yml` | Docker setup | 66 | Migrate to `podman-compose.yml` |

### 10.2 External Documentation

- **Ergo IRC**: https://ergo.chat/
- **IRCv3 Specs**: https://ircv3.net/
- **SASL PLAIN**: https://ircv3.net/specs/extensions/sasl-3.1
- **CHATHISTORY**: https://ircv3.net/specs/extensions/chathistory
- **Podman Compose**: https://github.com/containers/podman-compose
- **Socket.IO**: https://socket.io/docs/v4/
- **Electron IPC**: https://www.electronjs.org/docs/latest/api/ipc-main
- **Zustand**: https://zustand-demo.pmnd.rs/

### 10.3 TypeScript Configuration

**Root `tsconfig.base.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "incremental": true
  }
}
```

**Package-specific `tsconfig.json`** (example for `@ironcord/engine`):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared" }
  ]
}
```

---

## 11. Summary

This technical specification provides a comprehensive blueprint for transforming IronCord v1 into a modular, maintainable v2 architecture. The key pillars are:

1. **Strict Modularity**: No God Files, clear package boundaries, <300 lines per file
2. **Real-World Testing**: Zero mocks, 100% pass rate, blocking progression
3. **Podman-Native**: Unified container, rootless-ready, Windows-compatible
4. **Feature Parity**: Preserve all v1 functionality, glassmorphism design
5. **Industrial Grade**: DRY, strict TypeScript, comprehensive error handling

Implementation follows a phased approach with strict validation gates. Each phase requires 100% test pass rate before progression. The final deliverable is a production-ready modular monorepo with comprehensive test coverage and performance validation.

**Next Step**: Planning phase to break down specification into detailed implementation tasks.
