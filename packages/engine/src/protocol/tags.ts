import crypto from 'crypto';
import type { IRCMessageData } from '../types.js';

export function extractMessageData(
  tags: Record<string, string>,
  prefix: string | null,
  channel: string,
  content: string
): IRCMessageData {
  const author = prefix?.split('!')[0] || '';

  return {
    id: tags['msgid'] || crypto.randomUUID(),
    author,
    channel,
    content,
    account: tags['account'],
    timestamp: tags['time'],
  };
}

export function hasBatchTag(tags: Record<string, string>): boolean {
  return 'batch' in tags;
}

export function getBatchTag(tags: Record<string, string>): string | undefined {
  return tags['batch'];
}

export function getMessageId(tags: Record<string, string>): string {
  return tags['msgid'] || crypto.randomUUID();
}

export function getTimestamp(tags: Record<string, string>): string | undefined {
  return tags['time'];
}

export function getAccount(tags: Record<string, string>): string | undefined {
  return tags['account'];
}
