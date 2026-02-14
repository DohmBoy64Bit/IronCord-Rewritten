export interface MessageTags {
  msgid?: string;
  account?: string;
  time?: string;
  batch?: string;
  [key: string]: string | undefined;
}

export interface Message {
  id: string;
  author: string;
  channel: string;
  content: string;
  account?: string;
  timestamp?: string;
  reactions?: Record<string, string[]>; // emoji -> [nicks]
}

export interface HistoryRequest {
  channel: string;
  limit?: number;
}
