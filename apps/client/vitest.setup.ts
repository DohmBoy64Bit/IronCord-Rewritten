import '@testing-library/jest-dom/vitest';

global.window = {
  ironcord: {
    register: vi.fn(),
    login: vi.fn(),
    connectIRC: vi.fn(),
    sendMessage: vi.fn(),
    joinChannel: vi.fn(),
    partChannel: vi.fn(),
    requestHistory: vi.fn(),
    getMyGuilds: vi.fn(),
    getChannels: vi.fn(),
    createGuild: vi.fn(),
    createChannel: vi.fn(),
    setPresence: vi.fn(),
    onIRCRegistered: vi.fn(),
    onIRCConnected: vi.fn(),
    onIRCDisconnected: vi.fn(),
    onIRCMessage: vi.fn(),
    onIRCHistory: vi.fn(),
    onIRCMembers: vi.fn(),
    onIRCError: vi.fn(),
    onIRCPresence: vi.fn(),
    log: vi.fn(),
    windowControls: {
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
    },
  },
} as never;
