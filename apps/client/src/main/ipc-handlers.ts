import type { User, Guild, Channel, Message, AuthCredentials, CreateGuildRequest, CreateChannelRequest, HistoryRequest, UserPresence } from '@ironcord/shared/types';
import { ipcMain, BrowserWindow } from 'electron';
import { io, Socket } from 'socket.io-client';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

let socket: Socket | null = null;
let authToken: string | null = null;

async function httpRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows[0] || null;
}

function connectSocket(token: string): void {
  if (socket?.connected) {
    return;
  }

  socket = io(GATEWAY_URL, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  const mainWindow = getMainWindow();

  socket.on('connect', () => {
    mainWindow?.webContents.send('irc:connected');
  });

  socket.on('disconnect', () => {
    mainWindow?.webContents.send('irc:disconnected');
  });

  socket.on('irc:registered', () => {
    mainWindow?.webContents.send('irc:registered');
  });

  socket.on('irc:message', (message: Message) => {
    mainWindow?.webContents.send('irc:message', message);
  });

  socket.on('irc:history', (messages: Message[]) => {
    mainWindow?.webContents.send('irc:history', messages);
  });

  socket.on('irc:members', (data: { channel: string; members: string[] }) => {
    mainWindow?.webContents.send('irc:members', data);
  });

  socket.on('irc:presence', (data: { nick: string; status: string; message?: string }) => {
    mainWindow?.webContents.send('irc:presence', data);
  });

  socket.on('irc:typing', (data: { nick: string; target: string; status: 'active' | 'paused' | 'done' }) => {
    mainWindow?.webContents.send('irc:typing', data);
  });

  socket.on('irc:reaction', (data: { nick: string; target: string; msgId: string; reaction: string }) => {
    mainWindow?.webContents.send('irc:reaction', data);
  });

  socket.on('error', (error: Error) => {
    mainWindow?.webContents.send('irc:error', error);
  });
}

export function registerIPCHandlers(): void {
  ipcMain.handle('auth:register', async (_event, data: AuthCredentials & { irc_nick: string }) => {
    const result = await httpRequest<{ user: User; token: string }>('POST', '/auth/register', data);
    authToken = result.token;
    return result;
  });

  ipcMain.handle('auth:login', async (_event, data: AuthCredentials) => {
    const result = await httpRequest<{ user: User; token: string }>('POST', '/auth/login', data);
    authToken = result.token;
    return result;
  });

  ipcMain.handle('irc:connect', async (_event, userId: string, token: string) => {
    authToken = token;
    connectSocket(token);
    socket?.emit('irc:connect', { userId });
  });

  ipcMain.handle('irc:send-message', async (_event, channel: string, message: string) => {
    socket?.emit('irc:message', { target: channel, message });
  });

  ipcMain.handle('irc:join', async (_event, channel: string) => {
    socket?.emit('irc:join', { channel });
  });

  ipcMain.handle('irc:part', async (_event, channel: string) => {
    socket?.emit('irc:part', { channel });
  });

  ipcMain.handle('irc:request-history', async (_event, request: HistoryRequest) => {
    socket?.emit('irc:history', request);
  });

  ipcMain.handle('guilds:get-mine', async () => {
    const result = await httpRequest<{ guilds: Guild[] }>('GET', '/guilds/mine');
    return result.guilds;
  });

  ipcMain.handle('guilds:get-channels', async (_event, guildId: string) => {
    const result = await httpRequest<{ channels: Channel[] }>('GET', `/guilds/${guildId}/channels`);
    return result.channels;
  });

  ipcMain.handle('guilds:create', async (_event, data: CreateGuildRequest) => {
    const result = await httpRequest<{ guild: Guild }>('POST', '/guilds', data);
    return result.guild;
  });

  ipcMain.handle('guilds:get-discovery', async (_event, query?: string) => {
    const path = query ? `/guilds/discovery?q=${encodeURIComponent(query)}` : '/guilds/discovery';
    const result = await httpRequest<{ guilds: Guild[] }>('GET', path);
    return result.guilds;
  });

  ipcMain.handle('guilds:join-discovery', async (_event, guildId: string) => {
    const result = await httpRequest<{ guild: Guild }>('POST', `/guilds/${guildId}/join`);
    return result.guild;
  });

  ipcMain.handle('guilds:create-channel', async (_event, guildId: string, data: CreateChannelRequest) => {
    const result = await httpRequest<{ channel: Channel }>('POST', `/guilds/${guildId}/channels`, data);
    return result.channel;
  });

  ipcMain.handle('guilds:update', async (_event, guildId: string, data: Partial<CreateGuildRequest>) => {
    const result = await httpRequest<{ guild: Guild }>('PATCH', `/guilds/${guildId}`, data);
    return result.guild;
  });

  ipcMain.handle('guilds:update-channel', async (_event, guildId: string, channelId: string, data: Partial<CreateChannelRequest>) => {
    const result = await httpRequest<{ channel: Channel }>('PATCH', `/guilds/${guildId}/channels/${channelId}`, data);
    return result.channel;
  });

  ipcMain.handle('guilds:delete-channel', async (_event, guildId: string, channelId: string) => {
    await httpRequest<{ success: boolean }>('DELETE', `/guilds/${guildId}/channels/${channelId}`);
  });

  ipcMain.handle('presence:set', async (_event, status: UserPresence) => {
    socket?.emit('irc:presence', { status });
  });

  ipcMain.handle('irc:send-typing', async (_event, channel: string, status: 'active' | 'paused' | 'done') => {
    socket?.emit('irc:typing', { target: channel, status });
  });

  ipcMain.handle('irc:react', async (_event, target: string, msgId: string, reaction: string) => {
    socket?.emit('irc:react', { target, msgId, reaction });
  });



  ipcMain.handle('log', async (_event, tag: string, data: unknown) => {
    console.log(`[${tag}]`, data);
  });

  ipcMain.handle('window:minimize', async () => {
    const mainWindow = getMainWindow();
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', async () => {
    const mainWindow = getMainWindow();
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', async () => {
    const mainWindow = getMainWindow();
    mainWindow?.close();
  });
}

export function disconnectIRC(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
  authToken = null;
}
