export function formatCapabilityList(): string {
  return 'CAP LS 302';
}

export function formatCapabilityRequest(caps: string[]): string {
  return `CAP REQ :${caps.join(' ')}`;
}

export function formatCapabilityEnd(): string {
  return 'CAP END';
}

export function formatNick(nick: string): string {
  return `NICK ${nick}`;
}

export function formatUser(username: string, realname: string): string {
  return `USER ${username} 0 * :${realname}`;
}

export function formatPong(server: string): string {
  return `PONG :${server}`;
}

export function formatJoin(channel: string): string {
  return `JOIN ${channel}`;
}

export function formatPart(channel: string): string {
  return `PART ${channel}`;
}

export function formatPrivmsg(target: string, message: string): string {
  return `PRIVMSG ${target} :${message}`;
}

export function formatAway(message?: string): string {
  return message ? `AWAY :${message}` : 'AWAY';
}

export function formatQuit(message?: string): string {
  return message ? `QUIT :${message}` : 'QUIT';
}

export function formatRegister(nick: string, password: string, email?: string): string {
  const finalEmail = email || `${nick}@ironcord.local`;
  return `REGISTER ${nick} ${password} ${finalEmail}`;
}

export function formatAuthenticatePlain(): string {
  return 'AUTHENTICATE PLAIN';
}

export function formatAuthenticateResponse(nick: string, password: string): string {
  const authStr = `${nick}\0${nick}\0${password}`;
  return `AUTHENTICATE ${Buffer.from(authStr).toString('base64')}`;
}

export function formatTyping(target: string, status: 'active' | 'paused' | 'done'): string {
  return `@+typing=${status} TAGMSG ${target}`;
}

export function formatReaction(target: string, msgId: string, reaction: string): string {
  // IRCv3 +react spec: @+react=EMOJI;reply=MSGID TAGMSG TARGET
  // We add +reply as a client-only tag fallback because some servers (Ergo) might strip the standard 'reply' tag if not negotiated/supported fully in TAGMSG echo.
  return `@+react=${reaction};reply=${msgId};+reply=${msgId} TAGMSG ${target}`;
}
