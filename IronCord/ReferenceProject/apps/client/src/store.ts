import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  irc_nick: string;
  avatar_url?: string;
}

interface Guild {
  id: string;
  name: string;
  irc_namespace_prefix: string;
}

interface Channel {
  id: string;
  guild_id: string;
  name: string;
  irc_channel_name: string;
}

interface Message {
  id: string;
  channel: string;
  author: string;
  content: string;
  account?: string;
  timestamp: number;
}

interface AppState {
  user: User | null;
  guilds: Guild[];
  channels: Record<string, Channel[]>;
  currentGuild: Guild | null;
  currentChannel: Channel | null;
  messages: Record<string, Message[]>;
  members: Record<string, string[]>;
  userStatus: 'online' | 'idle' | 'dnd' | 'invisible';
  presence: Record<string, 'online' | 'away' | 'offline'>;
  setUser: (user: User | null) => void;
  setPresence: (nick: string, status: 'online' | 'away' | 'offline', message?: string) => void;
  setGuilds: (guilds: Guild[]) => void;
  setChannels: (guildId: string, channels: Channel[]) => void;
  setCurrentGuild: (guild: Guild | null) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  addMessage: (channel: string, message: Message) => void;
  setMessages: (channel: string, messages: Message[]) => void;
  setMembers: (channel: string, members: string[]) => void;
  setUserStatus: (status: 'online' | 'idle' | 'dnd' | 'invisible') => void;
  updateGuild: (guildId: string, updates: Partial<Guild>) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  deleteChannel: (channelId: string) => void;
  createChannel: (guildId: string, name: string) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  guilds: [],
  channels: {},
  currentGuild: null,
  currentChannel: null,
  messages: {},
  members: {},
  userStatus: 'online',
  presence: {},
  setUser: (user) => set({ user }),
  setPresence: (nick, status, message) =>
    set((state) => ({
      presence: { ...state.presence, [nick]: status }
    })),
  setGuilds: (guilds) => set({ guilds }),
  setChannels: (guildId, guildChannels) =>
    set((state) => ({
      channels: { ...state.channels, [guildId]: guildChannels }
    })),
  setCurrentGuild: (guild) => set({ currentGuild: guild, currentChannel: null }),
  setCurrentChannel: (channel) => set({ currentChannel: channel }),
  addMessage: (channel, message) =>
    set((state) => {
      const channelMessages = state.messages[channel] || [];
      // Deduplication: Check if ID already exists
      if (channelMessages.some(m => m.id === message.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [channel]: [...channelMessages, message]
        }
      };
    }),
  setMessages: (channel, messages) =>
    set((state) => ({
      messages: { ...state.messages, [channel]: messages }
    })),
  setMembers: (channel, channelMembers) =>
    set((state) => ({
      members: { ...state.members, [channel]: channelMembers }
    })),
  setUserStatus: (status) => set({ userStatus: status }),
  updateGuild: (guildId: string, updates: Partial<Guild>) => {
    console.log('[MOCK API] updateGuild:', { guildId, updates });
    set((state) => ({
      guilds: state.guilds.map((g) => (g.id === guildId ? { ...g, ...updates } : g)),
      currentGuild: state.currentGuild?.id === guildId ? { ...state.currentGuild, ...updates } : state.currentGuild,
    }));
  },
  updateChannel: (channelId: string, updates: Partial<Channel>) => {
    console.log('[MOCK API] updateChannel:', { channelId, updates });
    set((state) => {
      const newChannels = { ...state.channels };
      for (const guildId in newChannels) {
        newChannels[guildId] = newChannels[guildId].map((c) =>
          c.id === channelId ? { ...c, ...updates } : c
        );
      }
      return {
        channels: newChannels,
        currentChannel: state.currentChannel?.id === channelId
          ? { ...state.currentChannel, ...updates }
          : state.currentChannel,
      };
    });
  },
  deleteChannel: (channelId: string) => {
    console.log('[MOCK API] deleteChannel:', { channelId });
    set((state) => {
      // Helper to remove channel from all guilds' channel lists
      const newChannels = { ...state.channels };
      for (const guildId in newChannels) {
        newChannels[guildId] = newChannels[guildId].filter((c) => c.id !== channelId);
      }
      return {
        channels: newChannels,
        currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel,
      };
    });
  },
  createChannel: async (guildId: string, name: string) => {
    console.log('[API] createChannel:', { guildId, name });
    try {
      const newChannel = await window.ironcord.createChannel(guildId, name);
      if (newChannel && !newChannel.error) {
        set((state) => ({
          channels: {
            ...state.channels,
            [guildId]: [...(state.channels[guildId] || []), newChannel],
          },
        }));
      } else {
        console.error('Failed to create channel:', newChannel?.error);
      }
    } catch (err) {
      console.error('Failed to create channel (IPC):', err);
    }
  },
}));
