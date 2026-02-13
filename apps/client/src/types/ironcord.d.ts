import type { User, Guild, Channel, Message, UserPresence, AuthCredentials, CreateGuildRequest, CreateChannelRequest, HistoryRequest } from '@ironcord/shared/types';

interface IronCordAPI {
  register: (data: AuthCredentials & { irc_nick: string }) => Promise<{ user: User; token: string }>;
  login: (data: AuthCredentials) => Promise<{ user: User; token: string }>;

  connectIRC: (userId: string, token: string) => Promise<void>;
  sendMessage: (channel: string, message: string) => Promise<void>;
  joinChannel: (channel: string) => Promise<void>;
  partChannel: (channel: string) => Promise<void>;
  requestHistory: (request: HistoryRequest) => Promise<void>;

  getMyGuilds: () => Promise<Guild[]>;
  getChannels: (guildId: string) => Promise<Channel[]>;
  createGuild: (data: CreateGuildRequest) => Promise<Guild>;
  createChannel: (guildId: string, data: CreateChannelRequest) => Promise<Channel>;

  setPresence: (status: UserPresence) => Promise<void>;

  onIRCRegistered: (callback: () => void) => void;
  onIRCConnected: (callback: () => void) => void;
  onIRCDisconnected: (callback: () => void) => void;
  onIRCMessage: (callback: (msg: Message) => void) => void;
  onIRCHistory: (callback: (messages: Message[]) => void) => void;
  onIRCMembers: (callback: (data: { channel: string; members: string[] }) => void) => void;
  onIRCError: (callback: (err: Error) => void) => void;
  onIRCPresence: (callback: (data: { nick: string; status: string; message?: string }) => void) => void;

  log: (tag: string, data: unknown) => Promise<void>;

  windowControls: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };
}

declare global {
  interface Window {
    ironcord: IronCordAPI;
  }
}

export { IronCordAPI };
