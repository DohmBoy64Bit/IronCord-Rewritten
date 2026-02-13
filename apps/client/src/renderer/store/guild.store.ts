import type { Guild, Channel } from '@ironcord/shared/types';
import { create } from 'zustand';

interface GuildState {
  guilds: Guild[];
  currentGuildId: string | null;
  channels: Record<string, Channel[]>;
  currentChannelId: string | null;
  members: Record<string, string[]>;
  setGuilds: (guilds: Guild[]) => void;
  setCurrentGuild: (guildId: string | null) => void;
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
  setGuilds: (guilds) => set({ guilds }),
  setCurrentGuild: (guildId) => set({ currentGuildId: guildId, currentChannelId: null }),
  setChannels: (guildId, channels) =>
    set((state) => ({
      channels: { ...state.channels, [guildId]: channels },
    })),
  setCurrentChannel: (channelId) => set({ currentChannelId: channelId }),
  setMembers: (channel, channelMembers) =>
    set((state) => ({
      members: { ...state.members, [channel]: channelMembers },
    })),
  updateGuild: (guildId, updates) =>
    set((state) => ({
      guilds: state.guilds.map((g) => (g.id === guildId ? { ...g, ...updates } : g)),
    })),
  updateChannel: (channelId, updates) =>
    set((state) => {
      const newChannels = { ...state.channels };
      for (const guildId in newChannels) {
        newChannels[guildId] = newChannels[guildId].map((c) =>
          c.id === channelId ? { ...c, ...updates } : c
        );
      }
      return { channels: newChannels };
    }),
  deleteChannel: (channelId) =>
    set((state) => {
      const newChannels = { ...state.channels };
      for (const guildId in newChannels) {
        newChannels[guildId] = newChannels[guildId].filter((c) => c.id !== channelId);
      }
      return {
        channels: newChannels,
        currentChannelId: state.currentChannelId === channelId ? null : state.currentChannelId,
      };
    }),
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
