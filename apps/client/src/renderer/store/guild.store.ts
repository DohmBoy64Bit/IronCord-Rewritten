import { create } from 'zustand';
import type { Guild, Channel } from '@ironcord/shared/types';

interface GuildState {
  guilds: Guild[];
  currentGuildId: string | null;
  channels: Record<string, Channel[]>;
  currentChannelId: string | null;
  setGuilds: (guilds: Guild[]) => void;
  setCurrentGuild: (guildId: string) => void;
  setChannels: (guildId: string, channels: Channel[]) => void;
  setCurrentChannel: (channelId: string) => void;
}

export const useGuildStore = create<GuildState>((set) => ({
  guilds: [],
  currentGuildId: null,
  channels: {},
  currentChannelId: null,
  setGuilds: (guilds) => set({ guilds }),
  setCurrentGuild: (guildId) => set({ currentGuildId: guildId }),
  setChannels: (guildId, channels) =>
    set((state) => ({
      channels: { ...state.channels, [guildId]: channels },
    })),
  setCurrentChannel: (channelId) => set({ currentChannelId: channelId }),
}));
