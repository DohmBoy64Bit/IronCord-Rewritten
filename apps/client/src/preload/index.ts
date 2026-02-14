import { contextBridge, ipcRenderer } from 'electron';
import type { IronCordAPI } from '../types/ironcord';

const api: IronCordAPI = {
  register: (data) => ipcRenderer.invoke('auth:register', data),
  login: (data) => ipcRenderer.invoke('auth:login', data),

  connectIRC: (userId, token) => ipcRenderer.invoke('irc:connect', userId, token),
  sendMessage: (channel, message) => ipcRenderer.invoke('irc:send-message', channel, message),
  joinChannel: (channel) => ipcRenderer.invoke('irc:join', channel),
  partChannel: (channel) => ipcRenderer.invoke('irc:part', channel),
  requestHistory: (request) => ipcRenderer.invoke('irc:request-history', request),

  getMyGuilds: () => ipcRenderer.invoke('guilds:get-mine'),
  getChannels: (guildId) => ipcRenderer.invoke('guilds:get-channels', guildId),
  createGuild: (data) => ipcRenderer.invoke('guilds:create', data),
  updateGuild: (guildId, data) => ipcRenderer.invoke('guilds:update', guildId, data),
  createChannel: (guildId, data) => ipcRenderer.invoke('guilds:create-channel', guildId, data),
  updateChannel: (guildId, channelId, data) => ipcRenderer.invoke('guilds:update-channel', guildId, channelId, data),
  deleteChannel: (guildId, channelId) => ipcRenderer.invoke('guilds:delete-channel', guildId, channelId),

  setPresence: (status) => ipcRenderer.invoke('presence:set', status),

  onIRCRegistered: (callback) => {
    ipcRenderer.on('irc:registered', () => callback());
  },
  onIRCConnected: (callback) => {
    ipcRenderer.on('irc:connected', () => callback());
  },
  onIRCDisconnected: (callback) => {
    ipcRenderer.on('irc:disconnected', () => callback());
  },
  onIRCMessage: (callback) => {
    ipcRenderer.on('irc:message', (_event, msg) => callback(msg));
  },
  onIRCHistory: (callback) => {
    ipcRenderer.on('irc:history', (_event, messages) => callback(messages));
  },
  onIRCMembers: (callback) => {
    ipcRenderer.on('irc:members', (_event, data) => callback(data));
  },
  onIRCError: (callback) => {
    ipcRenderer.on('irc:error', (_event, err) => callback(err));
  },
  onIRCPresence: (callback) => {
    ipcRenderer.on('irc:presence', (_event, data) => callback(data));
  },

  log: (tag, data) => ipcRenderer.invoke('log', tag, data),

  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
};

contextBridge.exposeInMainWorld('ironcord', api);
