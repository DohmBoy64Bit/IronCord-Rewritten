import type { IRCMessage } from '../types.js';

export function parseIRCMessage(line: string): IRCMessage {
  let rawLine = line;
  const tags: Record<string, string> = {};

  if (rawLine.startsWith('@')) {
    const spaceIdx = rawLine.indexOf(' ');
    const tagsStr = rawLine.substring(1, spaceIdx);
    rawLine = rawLine.substring(spaceIdx + 1);

    for (const tag of tagsStr.split(';')) {
      const [key, value] = tag.split('=');
      if (key) {
        tags[key] = value || '';
      }
    }
  }

  const parts = rawLine.split(' ');
  const prefix = parts[0]?.startsWith(':') ? parts.shift()?.substring(1) ?? null : null;
  const command = parts.shift()?.toUpperCase() ?? '';

  const params: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part?.startsWith(':')) {
      params.push(parts.slice(i).join(' ').substring(1));
      break;
    }
    if (part) {
      params.push(part);
    }
  }

  return {
    tags,
    prefix,
    command,
    params,
    raw: line,
  };
}

export function extractNickFromPrefix(prefix: string | null): string {
  if (!prefix) return '';
  return prefix.split('!')[0] ?? '';
}
