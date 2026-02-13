# @ironcord/engine

IRC protocol engine for IronCord v2. Provides a modular, strictly-typed IRC client with IRCv3 capabilities.

## Features

- **IRCv3 Support**: SASL authentication, message tags, server-time, batch, chathistory
- **Modular Architecture**: Clean separation of concerns (protocol, capabilities, connection)
- **Reconnection Logic**: Exponential backoff with configurable retry limits
- **TypeScript**: Strict typing throughout, no `any` types
- **Event-Driven**: EventEmitter-based API for real-time IRC events
- **DRY Principles**: All files under 300 lines

## Installation

```bash
npm install @ironcord/engine
```

## Usage

```typescript
import { IRCClient } from '@ironcord/engine';

const client = new IRCClient({
  host: 'irc.example.com',
  port: 6667,
  nick: 'mybot',
  username: 'mybot',
  realname: 'My IRC Bot',
  password: 'optional-sasl-password',
});

client.on('registered', () => {
  console.log('Connected and registered!');
  client.join('#channel');
});

client.on('message', (msg) => {
  console.log(`${msg.author} in ${msg.channel}: ${msg.content}`);
});

client.on('history', (messages) => {
  console.log(`Received ${messages.length} historical messages`);
});

client.connect();
```

## API

### IRCClient

#### Constructor

```typescript
new IRCClient(config: IRCConfig, reconnectOptions?: Partial<ReconnectOptions>)
```

**IRCConfig**:
- `host: string` - IRC server hostname
- `port: number` - IRC server port
- `nick: string` - Nickname
- `username: string` - Username
- `realname: string` - Real name
- `password?: string` - Optional SASL password

**ReconnectOptions**:
- `maxRetries: number` - Maximum reconnection attempts (default: 10)
- `initialDelay: number` - Initial delay in ms (default: 1000)
- `maxDelay: number` - Maximum delay in ms (default: 30000)

#### Methods

- `connect()` - Connect to IRC server
- `disconnect()` - Disconnect from server
- `join(channel: string)` - Join a channel
- `part(channel: string)` - Leave a channel
- `privmsg(target: string, message: string)` - Send message
- `fetchHistory(channel: string, limit?: number)` - Request chat history
- `setPresence(status: 'online' | 'idle' | 'dnd' | 'invisible')` - Set away status
- `ready(): boolean` - Check if client is registered

#### Events

- `registered` - Successfully registered with server
- `message` - Received a message (IRCMessageData)
- `history` - Received historical messages (IRCMessageData[])
- `members` - Channel member list update (IRCMembers)
- `presence` - User presence change (IRCPresence)
- `error` - Error occurred
- `close` - Connection closed
- `reconnecting` - Attempting reconnection
- `reconnect_failed` - Max reconnection attempts reached

## Testing

### Unit Tests

Unit tests use mocked socket connections:

```bash
npm test
```

### Integration Tests with Real IRC Server

For full integration testing, you need a real Ergo IRC server running. The easiest way is with Podman/Docker:

```bash
# Start Ergo IRC server
podman run -d --name ergo-test -p 6667:6667 ergochat/ergo:latest

# Run integration tests
IRC_HOST=localhost IRC_PORT=6667 npm test

# Stop server
podman stop ergo-test
podman rm ergo-test
```

### Test Coverage

```bash
npm run test:coverage
```

Target coverage: >80%

## Architecture

```
src/
├── irc-client.ts          # Main IRC client class
├── types.ts               # TypeScript type definitions
├── protocol/
│   ├── parser.ts          # IRC message parsing
│   ├── formatter.ts       # IRC command formatting
│   ├── tags.ts            # IRCv3 message tags
│   └── handlers.ts        # Message routing and handling
├── capabilities/
│   ├── sasl.ts            # SASL authentication
│   ├── chathistory.ts     # CHATHISTORY capability
│   └── batch.ts           # BATCH message handling
└── connection/
    ├── socket.ts          # TCP socket wrapper
    └── reconnect.ts       # Reconnection logic
```

## File Size Constraints

All files must be under 300 lines to maintain modularity and readability.

## Dependencies

- `@ironcord/shared` - Shared types and utilities
- `events` - Node.js EventEmitter
- `net` - Node.js TCP sockets
- `crypto` - Message ID generation

## License

MIT
