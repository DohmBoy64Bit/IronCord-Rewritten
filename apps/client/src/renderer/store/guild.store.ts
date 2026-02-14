import type { Guild, Channel } from '@ironcord/shared/types';
import { create } from 'zustand';

interface GuildState {
  guilds: Guild[];
  currentGuildId: string | null;
  channels: Record<string, Channel[]>;
  currentChannelId: string | null;
  members: Record<string, string[]>;
  currentView: 'chat' | 'discovery';
  setGuilds: (guilds: Guild[]) => void;
  setCurrentGuild: (guildId: string | null) => void;
  setCurrentView: (view: 'chat' | 'discovery') => void;
  setChannels: (guildId: string, channels: Channel[]) => void;
  setCurrentChannel: (channelId: string) => void;
  setMembers: (channel: string, members: string[]) => void;
  updateGuild: (guildId: string, updates: Partial<Guild>) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  deleteChannel: (channelId: string) => void;
  createChannel: (guildId: string, name: string) => Promise<void>;
}

export const useGuildStore = create<GuildState>((set) => ({
  guilds: [],
  currentGuildId: null,
  channels: {},
  currentChannelId: null,
  members: {},
  currentView: 'chat',
  setGuilds: (guilds) => set({ guilds }),
  setCurrentGuild: (guildId) => set({ currentGuildId: guildId, currentChannelId: null, currentView: 'chat' }),
  setCurrentView: (view) => set({ currentView: view }),
  setChannels: (guildId, channels) =>
    set((state) => ({
      channels: { ...state.channels, [guildId]: channels },
    })),
  setCurrentChannel: (channelId) => set({ currentChannelId: channelId }),
  setMembers: (channel, channelMembers) =>
    set((state) => ({
      members: { ...state.members, [channel]: channelMembers },
    })),
  updateGuild: async (guildId, updates) => {
    try {
      const updatedGuild = await window.ironcord.updateGuild(guildId, updates);
      set((state) => ({
        guilds: state.guilds.map((g) => (g.id === guildId ? updatedGuild : g)),
      }));
    } catch (err) {
      console.error('Failed to update guild in store:', err);
      throw err;
    }
  },
  updateChannel: async (channelId, updates) => {
    try {
      const state = useGuildStore.getState();
      const currentGuildId = state.currentGuildId;
      if (!currentGuildId) return;

      const updatedChannel = await window.ironcord.updateChannel(currentGuildId, channelId, updates);
      set((state) => {
        const newChannels = { ...state.channels };
        for (const guildId in newChannels) {
          newChannels[guildId] = newChannels[guildId].map((c) =>
            c.id === channelId ? updatedChannel : c
          );
        }
        return { channels: newChannels };
      });
    } catch (err) {
      console.error('Failed to update channel in store:', err);
      throw err;
    }
  },
  deleteChannel: async (channelId) => {
    try {
      const state = useGuildStore.getState();
      const currentGuildId = state.currentGuildId;
      if (!currentGuildId) return;

      await window.ironcord.deleteChannel(currentGuildId, channelId);

      set((state) => {
        const newChannels = { ...state.channels };
        for (const guildId in newChannels) {
          newChannels[guildId] = newChannels[guildId].filter((c) => c.id !== channelId);
        }
        return {
          channels: newChannels,
          currentChannelId: state.currentChannelId === channelId ? null : state.currentChannelId,
        };
      });
    } catch (err) {
      console.error('Failed to delete channel in store:', err);
      throw err;
    }
  },
  createChannel: async (guildId, name) => {
    try {
      const channel = await window.ironcord.createChannel(guildId, { name });
      set((state) => ({
        channels: {
          ...state.channels,
          [guildId]: [...(state.channels[guildId] || []), channel],
        },
      }));
    } catch (err) {
      console.error('Failed to create channel in store:', err);
      throw err;
    }
  },
}));
