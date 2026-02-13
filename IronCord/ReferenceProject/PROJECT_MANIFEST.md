# IronCord Project Manifest

## 1. File Registry
| File Path | Responsibility | Key Exports | dependencies |
|-----------|----------------|-------------|--------------|
| `package.json` | Monorepo root configuration and script orchestration. | N/A | `apps/*`, `packages/*` |
| `tsconfig.json` | Global TypeScript configuration and path mapping. | N/A | `packages/shared/src` |
| `docker-compose.yml` | Container orchestration for Gateway, DB, and IRC services. | N/A | `apps/gateway`, `postgres`, `ergochat/ergo` |
| `README.md` | Project overview, architecture, and setup instructions. | N/A | `infra/*`, `apps/*` |
| `clean_build.ps1` | PowerShell script to reset and rebuild the Podman environment. | N/A | `podman compose` |
| `diagnose_bridge.ts` | End-to-end diagnostic tool for testing WS-to-IRC connectivity. | N/A | `socket.io-client`, `jsonwebtoken` |
| `apps/client/package.json` | Dependencies and scripts for the Electron client app. | N/A | `react`, `zustand`, `electron` |
| `apps/client/forge.config.ts` | Electron Forge configuration for packaging and Vite integration. | `default config` | `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts` |
| `apps/client/vitest.setup.ts` | Test environment setup, mocking the `window.ironcord` bridge. | `mockIroncord` | `vitest` |
| `apps/client/src/main.ts` | Electron main process: manages windows, sockets, and IPC handlers. | N/A | `electron`, `socket.io-client`, `./logger` |
| `apps/client/src/preload.ts` | IPC bridge exposing `window.ironcord` to the renderer. | N/A | `electron` |
| `apps/client/src/store.ts` | Zustand global state management for the React frontend. | `useStore` | `zustand`, `window.ironcord` |
| `apps/client/src/App.tsx` | Main React component: orchestrates views and IRC event bootstrapping. | `App` | `./store`, `./components/*`, `window.ironcord` |
| `apps/client/src/logger.ts` | Utility for file and console logging in the main process. | `logger` | `fs`, `path` |
| `apps/client/src/ironcord.d.ts` | Type definitions for the `window.ironcord` IPC bridge. | N/A | N/A |
| `apps/client/src/components/Sidebar.tsx` | Vertical server navigation bar. | `Sidebar` | `lucide-react`, `./CreateGuildModal` |
| `apps/client/src/components/ChannelList.tsx` | Channel list, status management, and settings access. | `ChannelList` | `window.ironcord`, `./ServerSettingsModal` |
| `apps/client/src/components/Chat.tsx` | Main chat UI with message list, search, and member panel. | `Chat` | `window.ironcord`, `lucide-react` |
| `apps/client/src/components/Login.tsx` | User login interface. | `Login` | `window.ironcord.login` |
| `apps/client/src/components/Register.tsx` | User account registration interface. | `Register` | `window.ironcord.register` |
| `apps/client/src/components/CreateGuildModal.tsx` | Multi-step modal for server creation. | `CreateGuildModal` | `window.ironcord.createGuild` |
| `apps/client/src/components/ChannelContextMenu.tsx` | Portal-based context menu for channel management. | `ChannelContextMenu` | `react-dom` |
| `apps/gateway/package.json` | Dependencies and scripts for the Node.js gateway. | N/A | `express`, `socket.io`, `pg` |
| `apps/gateway/src/index.ts` | Gateway entry point: initializes Express, DB, and WS. | N/A | `./services/db.service`, `./api/*` |
| `apps/gateway/src/api/auth.ts` | Auth API: register and login routes. | `default router` | `bcryptjs`, `jsonwebtoken` |
| `apps/gateway/src/api/guilds.ts` | Guild API: CRUD for guilds and channels. | `default router` | `../middleware/auth.middleware` |
| `apps/gateway/src/api/websocket.ts` | Socket.IO server: bridges client to `IRCClient`. | `WebSocketServer` | `../irc-client`, `socket.io` |
| `apps/gateway/src/irc-client.ts` | Core IRC protocol implementation with IRCv3 support. | `IRCClient` | `net`, `events` |
| `apps/gateway/src/services/db.service.ts` | Database interface using PostgreSQL connection pool. | `dbService` | `pg` |
| `apps/gateway/src/db/schema.sql` | PostgreSQL schema definition (Users, Guilds, Channels). | N/A | N/A |
| `packages/shared/package.json` | Dependencies for the shared utility package. | N/A | N/A |
| `packages/shared/src/types.ts` | Central type definitions for the entire monorepo. | `User`, `Guild`, `Message`, etc. | N/A |
| `packages/shared/src/logger.ts` | Shared logging utility for all environments. | `logger` | `fs`, `path` |
| `infra/ircd/ergo.conf` | Ergo IRCd configuration (SASL, CHATHISTORY). | N/A | N/A |






## 2. Feature & Control Flow Map
- **User Actions:**
  - **Diagnostic Connectivity Check**
    - Trigger: `ts-node diagnose_bridge.ts`
    - Handler: `diagnose_bridge.ts` (Socket.IO client)
    - API: `POST /guilds`
    - Event Emit: `socket.emit('irc:connect', ...)`
- **Client IPC Bridge**
  - Trigger: `window.ironcord.[method]()`
  - Handler: `preload.ts` (Forwarding to Main)
  - Backend Action: Electron Main process invokes `fetch` to Gateway or emits Socket.IO event.
  - Key Actions: `register`, `login`, `connectIRC`, `sendMessage`, `createGuild`, `setPresence`
- **Frontend Bootstrapping**
  - Trigger: Successful login (`user` state set in `App.tsx`)
  - Actions: `getMyGuilds`, `connectIRC`, initialize IRC event listeners.
- **Guild Creation Flow**
  - Trigger: `POST /guilds`
  - Handler: `apps/gateway/src/api/guilds.ts`
  - Action: Inserts to `guilds`, `guild_members`, `channels` (#general).
  - Event Emit: `gatewayEvents.emit('irc:immediate-join')`.
  - WS Action: `WebSocketServer` calls `client.join(channel)`.




## 3. Protocol Dictionary
- **Socket Events:**
  - `irc:connect`: Payload `{ config: { nick, username, gecos, server, port } }`
  - `irc:registered`: Fired when IRC registration is confirmed by gateway.
  - `irc:error`: Error payload from gateway.
- **Client IPC Methods (`window.ironcord`):**
  - `register(data)` / `login(credentials)`
  - `connectIRC(config)`
  - `sendMessage(channel, message)`
  - `getMyGuilds()` / `getChannels(guildId)`
  - `createGuild(name)`
  - `setPresence(status)`
  - **Listeners:** `onIRCRegistered`, `onIRCConnected`, `onIRCDisconnected`, `onIRCMessage`, `onIRCHistory`, `onIRCMembers`, `onIRCError`
- **IRC Commands Used (via `IRCClient`):**
  - `CAP LS 302 / REQ / END`
  - `NICK`, `USER`, `PASS`
  - `AUTHENTICATE` (SASL PLAIN)
  - `JOIN`, `PART`, `QUIT`, `KICK`
  - `PRIVMSG` (with `msgid`, `time` tags)
  - `CHATHISTORY LATEST`
  - `AWAY` (Presence mapping)


## 4. Known Gaps (The "Hallucination Killer")
- *(All identified internal files and functions have been read and documented. No known hallucinations detected.)*
