import path from 'path';
import { app, BrowserWindow } from 'electron';
import { registerIPCHandlers, disconnectIRC } from './ipc-handlers.js';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  console.log('[Main] Creating application window...');
  console.log('[Main] Preload path:', MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY);
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('[Main] Loading development server:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL).catch((err) => {
      console.error('[Main] Failed to load dev server:', err);
    });
  } else {
    const rendererPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    console.log('[Main] Loading renderer from:', rendererPath);
    mainWindow.loadFile(rendererPath).catch((err) => {
      console.error('[Main] Failed to load renderer:', err);
    });
  }

  mainWindow.on('closed', () => {
    console.log('[Main] Window closed');
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Main] Renderer failed to load:', errorCode, errorDescription);
  });
};

app.on('ready', () => {
  console.log('[Main] App ready, initializing...');
  try {
    registerIPCHandlers();
    createWindow();
  } catch (err) {
    console.error('[Main] Failed to initialize:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  console.log('[Main] All windows closed');
  disconnectIRC();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('[Main] App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  console.log('[Main] App quitting, cleaning up...');
  disconnectIRC();
});

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});
