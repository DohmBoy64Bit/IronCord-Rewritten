import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import * as fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { io, Socket } from 'socket.io-client';
import { logger } from './logger';

const AUTH_FILE = path.join(app.getPath('userData'), 'auth_session.json');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
console.log(`[MAIN] Startup: argv=${JSON.stringify(process.argv)}`);
console.log(`[MAIN] UserData: ${app.getPath('userData')}`);

app.on('will-quit', () => console.log('[MAIN] App will-quit'));
app.on('quit', (e, exitCode) => console.log(`[MAIN] App quit: code=${exitCode}`));
process.on('uncaughtException', err => console.log(`[MAIN] Uncaught Exception: ${err.message}\n${err.stack}`));
process.on('unhandledRejection', (reason, promise) => console.log(`[MAIN] Unhandled Rejection at: ${promise} reason: ${reason}`));

// if (started) {
//   app.quit();
// }

// --- Persistence ---
function loadAuthSession() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const data = fs.readFileSync(AUTH_FILE, 'utf8');
      const session = JSON.parse(data);
      authToken = session.token || null;
    }
  } catch (err) {
    console.error('Failed to load auth session:', err);
  }
}

function saveAuthSession(token: string | null) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ token }));
  } catch (err) {
    console.error('Failed to save auth session:', err);
  }
}

let socket: Socket | null = null;
let mainWindow: BrowserWindow | null = null;
let authToken: string | null = null;

loadAuthSession(); // Load on start

const GATEWAY_URL = process.env.VITE_GATEWAY_URL || 'http://localhost:3000';

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('close', () => console.log('[MAIN] Window close event'));
  mainWindow.on('closed', () => console.log('[MAIN] Window closed event'));
  mainWindow.on('unresponsive', () => console.log('[MAIN] Window unresponsive'));
  mainWindow.webContents.on('render-process-gone', (e, details) => console.log(`[MAIN] Render process gone: ${JSON.stringify(details)}`));
};

// --- Helper ---
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

// --- IPC Handlers ---

ipcMain.handle('irc:connect', (event, { userId, config }) => {
  logger.info('CLIENT-IPC', {
    event: 'irc:connect',
    userId,
    config,
  });

  if (socket) {
    logger.info('CLIENT-SOCKET', {
      event: 'closing_previous',
    });
    socket.disconnect();
  }

  logger.info('CLIENT-SOCKET', {
    event: 'connecting',
    gatewayUrl: GATEWAY_URL,
    hasToken: !!authToken,
  });

  socket = io(GATEWAY_URL, {
    auth: { token: authToken },
  });

  socket.on('connect', () => {
    logger.info('CLIENT-SOCKET', {
      event: 'connected',
      gatewayUrl: GATEWAY_URL,
      socketId: socket!.id,
      userId,
    });
    socket!.emit('irc:connect', { config });
    mainWindow?.webContents.send('irc:connected');
  });

  socket.on('connect_error', (err: Error) => {
    logger.error('CLIENT-SOCKET', {
      event: 'connect_error',
      message: err.message,
      stack: err.stack,
    });
  });

  socket.on('irc:registered', () => {
    mainWindow?.webContents.send('irc:registered');
  });

  socket.on('irc:message', (msg) => {
    mainWindow?.webContents.send('irc:message', msg);
  });

  socket.on('irc:history', (data: any) => {
    mainWindow?.webContents.send('irc:history', data);
  });

  socket.on('irc:members', (data) => {
    mainWindow?.webContents.send('irc:members', data);
  });

  socket.on('irc:error', (err) => {
    mainWindow?.webContents.send('irc:error', err);
  });

  socket.on('irc:presence', (data) => {
    mainWindow?.webContents.send('irc:presence', data);
  });

  socket.on('disconnect', () => {
    logger.info('CLIENT-SOCKET', { event: 'disconnected' });
    mainWindow?.webContents.send('irc:disconnected');
  });
});

ipcMain.handle('irc:presence', (event, { status }) => {
  logger.info('CLIENT-IPC', { event: 'irc:presence', status });
  socket?.emit('irc:presence', { status });
});

ipcMain.handle('irc:send-message', (event, { channel, message }) => {
  logger.debug('CLIENT-IPC', { event: 'irc:send-message', channel, message });
  socket?.emit('irc:message', { channel, message });
});

ipcMain.handle('log:write', (event, { tag, data }) => {
  logger.info(`RENDERER-${tag}`, data);
});

ipcMain.handle('auth:register', async (event, data) => {
  try {
    const res = await fetch(`${GATEWAY_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if ((result as any).token) {
      authToken = (result as any).token;
      saveAuthSession(authToken);
    }
    return result;
  } catch (err: any) {
    console.error('[MAIN] auth:register error:', err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('auth:login', async (event, data) => {
  try {
    const res = await fetch(`${GATEWAY_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if ((result as any).token) {
      authToken = (result as any).token;
      saveAuthSession(authToken);
    }
    return result;
  } catch (err: any) {
    console.error('[MAIN] auth:login error:', err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('guilds:get-mine', async (event) => {
  try {
    const res = await fetch(`${GATEWAY_URL}/guilds/mine`, {
      headers: authHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    console.error('[MAIN] guilds:get-mine error:', err);
    return [];
  }
});

ipcMain.handle('guilds:get-channels', async (event, guildId) => {
  const res = await fetch(`${GATEWAY_URL}/guilds/${guildId}/channels`, {
    headers: authHeaders(),
  });
  return await res.json();
});

ipcMain.handle('guilds:create', async (event, { name }) => {
  const res = await fetch(`${GATEWAY_URL}/guilds`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  return await res.json();
});

ipcMain.handle('guilds:create-channel', async (event, { guildId, name }) => {
  const res = await fetch(`${GATEWAY_URL}/guilds/${guildId}/channels`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  return await res.json();
});

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:toggle-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// --- Lifecycle ---

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  console.log('[MAIN] window-all-closed event');
  // if (process.platform !== 'darwin') {
  //   app.quit();
  // }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
