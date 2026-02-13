export interface IRCConfig {
  host: string;
  port: number;
  nick: string;
  username: string;
  realname: string;
  password?: string;
}

export interface ReconnectOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
}

export interface IRCMessage {
  tags: Record<string, string>;
  prefix: string | null;
  command: string;
  params: string[];
  raw: string;
}

export interface IRCMessageData {
  id: string;
  author: string;
  channel: string;
  content: string;
  account?: string;
  timestamp?: string;
}

export interface IRCPresence {
  nick: string;
  status: 'online' | 'away';
  message: string;
}

export interface IRCMembers {
  channel: string;
  members: string[];
}

export interface ReconnectEvent {
  attempt: number;
  delay: number;
}

export type IRCClientEvents = {
  registered: () => void;
  message: (data: IRCMessageData) => void;
  history: (messages: IRCMessageData[]) => void;
  members: (data: IRCMembers) => void;
  presence: (data: IRCPresence) => void;
  error: (error: Error) => void;
  close: () => void;
  reconnecting: (event: ReconnectEvent) => void;
  reconnect_failed: () => void;
};
