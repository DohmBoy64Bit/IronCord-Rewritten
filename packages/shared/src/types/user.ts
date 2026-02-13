export interface User {
  id: string;
  email: string;
  irc_nick: string;
  avatar_url?: string;
  created_at: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
  irc_nick?: string;
}

export type UserPresence = 'online' | 'idle' | 'dnd' | 'invisible';

export interface PresenceUpdate {
  nick: string;
  status: 'online' | 'away';
  message?: string;
}
