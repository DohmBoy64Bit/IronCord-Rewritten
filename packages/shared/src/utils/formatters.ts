export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toISOString();
}

export function formatUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function formatNickname(email: string): string {
  const localPart = email.split('@')[0];
  if (!localPart) {
    return `user${Math.random().toString(36).substring(2, 8)}`;
  }
  const cleaned = localPart.replace(/[^a-zA-Z0-9]/g, '');
  const nickname = cleaned.slice(0, 32);
  return nickname.length > 0 && /^[a-zA-Z]/.test(nickname) 
    ? nickname 
    : `user${Math.random().toString(36).substring(2, 8)}`;
}

export function formatTimestamp(timestamp?: string): string {
  if (!timestamp) {
    return new Date().toISOString();
  }
  return formatDate(timestamp);
}
