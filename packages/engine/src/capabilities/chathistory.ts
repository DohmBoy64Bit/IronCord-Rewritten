export function formatChatHistoryLatest(channel: string, limit: number): string {
  return `CHATHISTORY LATEST ${channel} * ${limit}`;
}

export function formatChatHistoryBefore(channel: string, timestamp: string, limit: number): string {
  return `CHATHISTORY BEFORE ${channel} timestamp=${timestamp} ${limit}`;
}

export function formatChatHistoryAfter(channel: string, timestamp: string, limit: number): string {
  return `CHATHISTORY AFTER ${channel} timestamp=${timestamp} ${limit}`;
}

export function formatChatHistoryBetween(
  channel: string,
  startTimestamp: string,
  endTimestamp: string,
  limit: number
): string {
  return `CHATHISTORY BETWEEN ${channel} timestamp=${startTimestamp} timestamp=${endTimestamp} ${limit}`;
}

export function formatChatHistoryAround(channel: string, msgid: string, limit: number): string {
  return `CHATHISTORY AROUND ${channel} msgid=${msgid} ${limit}`;
}
