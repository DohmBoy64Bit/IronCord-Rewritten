import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useGuildStore } from '../store/guild.store';
import { usePresenceStore } from '../store/presence.store';
import { Hash, Settings, Plus } from 'lucide-react';
import type { Channel } from '@ironcord/shared/types';

function nickColor(nick: string): string {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < nick.length; i++) {
    hash = nick.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const ChannelList: React.FC = () => {
  const { user } = useAuthStore();
  const { guilds, currentGuildId, channels, setChannels, currentChannelId, setCurrentChannel } = useGuildStore();
  const { presences } = usePresenceStore();
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const currentGuild = guilds.find(g => g.id === currentGuildId);
  const guildChannels = currentGuildId ? channels[currentGuildId] || [] : [];
  const currentChannel = guildChannels.find(c => c.id === currentChannelId);
  const userNick = user?.irc_nick || 'Unknown User';
  const userPresence = presences[userNick] || 'online';

  useEffect(() => {
    if (currentGuildId && !channels[currentGuildId]) {
      window.ironcord.getChannels(currentGuildId).then((guildChannels: Channel[]) => {
        setChannels(currentGuildId, guildChannels);
      });
    }
  }, [currentGuildId, channels, setChannels]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentGuildId && newChannelName.trim()) {
      try {
        const channel = await window.ironcord.createChannel(currentGuildId, { name: newChannelName.trim() });
        setChannels(currentGuildId, [...guildChannels, channel]);
        setNewChannelName('');
        setIsCreatingChannel(false);
      } catch (err) {
        console.error('Failed to create channel:', err);
      }
    }
  };

  const handleStatusChange = async (status: 'online' | 'idle' | 'dnd' | 'invisible') => {
    setShowStatusMenu(false);
    try {
      await window.ironcord.setPresence(status);
    } catch (err) {
      console.error('Failed to set presence:', err);
    }
  };

  const statusColors = {
    online: 'bg-emerald-500',
    idle: 'bg-amber-500',
    dnd: 'bg-red-500',
    invisible: 'bg-gray-500',
  };

  const statusLabels = {
    online: 'Online',
    idle: 'Idle',
    dnd: 'Do Not Disturb',
    invisible: 'Invisible',
  };

  return (
    <div className="glass-panel flex w-60 flex-col bg-black/20 backdrop-blur-lg border-x-0 my-1 h-[calc(100%-8px)] relative">
      <div className="flex h-12 cursor-pointer items-center justify-between border-b border-black/20 px-4 font-bold text-white shadow-sm transition-colors hover:bg-white/5">
        <span className="truncate">{currentGuild ? currentGuild.name : 'Direct Messages'}</span>
        {currentGuild && (
          <div className="flex items-center space-x-1">
            <Plus
              size={16}
              className="text-gray-400 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsCreatingChannel(true);
              }}
            />
            <Settings
              size={16}
              className="text-gray-400 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                const event = new CustomEvent('show-toast', { detail: 'Server Settings' });
                window.dispatchEvent(event);
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex-1 space-y-[2px] px-2 overflow-y-auto">
        {guildChannels.map((channel: Channel) => (
          <div
            key={channel.id}
            onClick={() => setCurrentChannel(channel.id)}
            className={`group flex cursor-pointer items-center rounded-md px-2 py-1 transition-all duration-200 ${
              currentChannel?.id === channel.id
                ? 'bg-white/10 text-white shadow-inner'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
          >
            <Hash size={20} className="mr-2 text-gray-500" />
            <span className="font-medium">{channel.name}</span>
          </div>
        ))}
      </div>

      <div className="relative flex items-center bg-black/40 p-2">
        <div
          className="flex items-center space-x-2 overflow-hidden rounded p-1 transition-colors flex-1 cursor-pointer hover:bg-white/5"
          onClick={() => setShowStatusMenu(!showStatusMenu)}
        >
          <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${nickColor(userNick)}`}>
            <span className="text-xs font-bold text-white uppercase">{userNick.charAt(0)}</span>
            <div className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-gray-900 ${statusColors[userPresence as keyof typeof statusColors]}`} />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-bold text-white truncate">{userNick}</span>
            <span className="text-[10px] text-gray-400">{statusLabels[userPresence as keyof typeof statusLabels]}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center space-x-1 text-gray-400">
          <div
            className="cursor-pointer rounded-md p-1 hover:bg-gray-800"
            onClick={(e) => {
              e.stopPropagation();
              const event = new CustomEvent('show-toast', { detail: 'User Settings' });
              window.dispatchEvent(event);
            }}
          >
            <Settings data-testid="Settings" size={16} />
          </div>
        </div>

        {showStatusMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
            <div className="glass-panel absolute bottom-14 left-2 z-50 w-56 rounded-lg bg-black/80 backdrop-blur-xl p-2 shadow-xl border-white/10 ring-1 ring-black/50">
              <div className="space-y-1">
                {(['online', 'idle', 'dnd', 'invisible'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className="flex w-full items-center space-x-2 rounded px-2 py-1.5 text-left text-sm text-gray-300 hover:bg-indigo-500 hover:text-white transition-colors"
                  >
                    <div className={`h-2 w-2 rounded-full ${statusColors[status]}`} />
                    <span>{statusLabels[status]}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {isCreatingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-80 rounded-lg bg-gray-900 border border-emerald-500/20 p-4 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">Create Channel</h3>
            <form onSubmit={handleCreateChannel}>
              <input
                autoFocus
                type="text"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                className="w-full bg-black/20 text-white border border-gray-700 rounded p-2 mb-4 outline-none focus:border-emerald-500"
                placeholder="Channel name"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingChannel(false)}
                  className="px-3 py-1 rounded text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim()}
                  className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-bold disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
