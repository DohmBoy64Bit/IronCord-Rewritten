import type { Channel } from '@ironcord/shared/types';
import { Hash, Settings, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useGuildStore } from '../store/guild.store';
import { usePresenceStore } from '../store/presence.store';
import { ServerSettingsModal } from './ServerSettingsModal';
import { ChannelContextMenu } from './ChannelContextMenu';
import { CreateChannelModal } from './CreateChannelModal';

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
  const user = useAuthStore((state) => state.user);
  const guilds = useGuildStore((state) => state.guilds);
  const currentGuildId = useGuildStore((state) => state.currentGuildId);
  const channels = useGuildStore((state) => state.channels);
  const setChannels = useGuildStore((state) => state.setChannels);
  const currentChannelId = useGuildStore((state) => state.currentChannelId);
  const setCurrentChannel = useGuildStore((state) => state.setCurrentChannel);
  const presences = usePresenceStore((state) => state.presences);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channelId: string } | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  const guildsList = Array.isArray(guilds) ? guilds : [];
  const channelsMap = channels && typeof channels === 'object' ? channels : {};
  const presencesMap = presences && typeof presences === 'object' ? presences : {};

  const currentGuild = guildsList.find(g => g.id === currentGuildId);
  const guildChannels = currentGuildId ? channelsMap[currentGuildId] || [] : [];
  const currentChannel = guildChannels.find(c => c.id === currentChannelId);
  const userNick = user?.irc_nick || 'Unknown User';
  const userPresence = presencesMap[userNick] || 'online';

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    window.ironcord.onIRCConnected(onConnect);
    window.ironcord.onIRCDisconnected(onDisconnect);
    window.ironcord.onIRCRegistered(onConnect);

    setIsConnected(true);
  }, []);

  useEffect(() => {
    if (currentGuildId && !channels[currentGuildId]) {
      window.ironcord.getChannels(currentGuildId).then((guildChannels: Channel[]) => {
        setChannels(currentGuildId, guildChannels);
      });
    }
  }, [currentGuildId, channels, setChannels]);

  useEffect(() => {
    setShowServerSettings(false);
    setContextMenu(null);
  }, [currentGuildId]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentGuildId && newChannelName.trim()) {
      try {
        await useGuildStore.getState().createChannel(currentGuildId, newChannelName.trim());
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
      if (userNick) {
        usePresenceStore.getState().setPresence(userNick, status);
      }
      await window.ironcord.setPresence(status);
    } catch (err) {
      console.error('Failed to set presence:', err);
    }
  };

  const statusColors = {
    online: 'bg-emerald-500',
    idle: 'bg-amber-500',
    away: 'bg-amber-500',
    dnd: 'bg-red-500',
    invisible: 'bg-gray-500',
  };

  const statusLabels = {
    online: 'Online',
    idle: 'Idle',
    dnd: 'Do Not Disturb',
    invisible: 'Invisible',
    away: 'Idle', // Map generic away back to the primary facade status
  };

  return (
    <div className="glass-panel flex w-60 flex-col bg-black/20 backdrop-blur-lg border-x-0 my-1 h-[calc(100%-8px)] relative">
      <div className="flex h-12 cursor-pointer items-center justify-between border-b border-black/20 px-4 font-bold text-white shadow-sm transition-colors hover:bg-white/5">
        <span className="flex-1 min-w-0 truncate">{currentGuild ? currentGuild.name : 'Direct Messages'}</span>
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
                setShowServerSettings(true);
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
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, channelId: channel.id });
            }}
            className={`group flex cursor-pointer items-center rounded-md px-2 py-1 transition-all duration-200 ${currentChannel?.id === channel.id
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
          className={`flex items-center space-x-2 overflow-hidden rounded p-1 transition-colors flex-1 ${isConnected ? 'cursor-pointer hover:bg-white/5' : 'cursor-not-allowed opacity-75'}`}
          onClick={() => isConnected && setShowStatusMenu(!showStatusMenu)}
        >
          <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${nickColor(userNick)}`}>
            <span className="text-xs font-bold text-white uppercase">{userNick.charAt(0)}</span>
            <div className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-gray-900 ${isConnected ? (statusColors[userPresence as keyof typeof statusColors] || statusColors.idle) : 'bg-red-500'}`} />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-bold text-white truncate">{userNick}</span>
            <span className="text-[10px] text-gray-400">{isConnected ? (statusLabels[userPresence as keyof typeof statusLabels] || 'Idle') : 'Disconnected'}</span>
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
                    <div className={`h-2 w-2 rounded-full ${statusColors[status as keyof typeof statusColors]}`} />
                    <span>{statusLabels[status as keyof typeof statusLabels]}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <CreateChannelModal
        isOpen={isCreatingChannel}
        onClose={() => setIsCreatingChannel(false)}
        guildId={currentGuildId || ''}
      />

      <ServerSettingsModal
        isOpen={showServerSettings}
        onClose={() => setShowServerSettings(false)}
      />

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <ChannelContextMenu
            channelId={contextMenu.channelId}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={() => setContextMenu(null)}
          />
        </>
      )}
    </div>
  );
};
