# IronCord v2

**Industrial-Grade Discord Clone Using IRC as Backbone**

## Overview

IronCord v2 is a modular rewrite of the original IronCord application. It's an Electron-based Discord clone that uses IRC (Internet Relay Chat) as its messaging backbone, with a modern glassmorphism UI powered by Tailwind CSS v4.

## Architecture

This is a **monorepo** using NPM workspaces, organized into packages and applications:

### Packages (`/packages`)

- **`@ironcord/shared`** - Shared types, utilities, and constants
- **`@ironcord/engine`** - IRC protocol implementation (IRCv3 with SASL, CHATHISTORY, BATCH)
- **`@ironcord/db`** - Database service layer with repository pattern (PostgreSQL)

### Applications (`/apps`)

- **`@ironcord/gateway`** - Express + Socket.IO gateway server with integrated Ergo IRC server
- **`@ironcord/client`** - Electron desktop application with React renderer

## Technology Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5+ (strict mode)
- **IRC Server**: Ergo IRCd v2.14.0
- **Database**: PostgreSQL 15
- **Orchestration**: Podman Compose
- **Client Framework**: Electron + React
- **UI Styling**: Tailwind CSS v4 (glassmorphism)
- **Real-time**: Socket.IO
- **Testing**: Vitest (unit), Playwright (E2E)

## Design Principles

1. **Zero Hallucination**: Every implementation references the manifest and source-of-truth documentation
2. **Industrial Grade**: DRY, strictly typed, modular design
3. **No God Files**: Maximum file size 300 lines
4. **Real Testing**: All tests run against real services (PostgreSQL, Ergo IRC)
5. **Podman-Native**: Rootless containers with proper networking

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Podman >= 4.0.0

### Installation

```bash
npm install
```

### Development

```bash
# Build all packages
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Workspace Structure

```
ironcord-v2/
├── packages/
│   ├── shared/       # Shared types and utilities
│   ├── engine/       # IRC protocol layer
│   └── db/           # Database service layer
├── apps/
│   ├── gateway/      # Backend API + WebSocket + IRC server
│   └── client/       # Electron desktop application
├── infra/
│   └── podman/       # Container configurations
├── tsconfig.base.json
└── package.json
```

## Testing Philosophy

- **Unit Tests**: Vitest with real service dependencies
- **Integration Tests**: Real PostgreSQL + Real Ergo IRC server
- **E2E Tests**: Playwright with full stack running
- **No Mocks**: All tests use real services via Podman

## License

MIT
