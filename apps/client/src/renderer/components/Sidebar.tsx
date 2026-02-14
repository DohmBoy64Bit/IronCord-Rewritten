import { MessageSquare, Plus, Compass } from 'lucide-react';
import React, { useState } from 'react';
import { useGuildStore } from '../store/guild.store';
import { CreateGuildModal } from './CreateGuildModal';

export const Sidebar: React.FC = () => {
  const guilds = useGuildStore((state) => state.guilds);
  const currentGuildId = useGuildStore((state) => state.currentGuildId);
  const currentView = useGuildStore((state) => state.currentView);
  const setCurrentGuild = useGuildStore((state) => state.setCurrentGuild);
  const setCurrentView = useGuildStore((state) => state.setCurrentView);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const guildsList = Array.isArray(guilds) ? guilds : [];
  const currentGuild = guildsList.find(g => g.id === currentGuildId);

  return (
    <>
      <div className="glass-panel flex w-20 flex-col items-center space-y-4 bg-black/40 backdrop-blur-xl py-3 border-r-0 rounded-l-lg my-1 ml-1 h-[calc(100%-8px)]">
        <div
          onClick={() => {
            setCurrentGuild(null);
            const event = new CustomEvent('show-toast', { detail: 'Direct Messages' });
            window.dispatchEvent(event);
          }}
          className="group relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-3xl bg-gray-800 text-indigo-500 transition-[border-radius,background-color,color] duration-200 shadow-none hover:rounded-2xl hover:bg-indigo-600 hover:text-white"
        >
          <div className={`absolute -left-4 w-1 rounded-r-full bg-white transition-[height,opacity] duration-200 ${currentView === 'chat' && currentGuildId === null
            ? 'h-10 opacity-100'
            : 'h-0 opacity-0 group-hover:h-5 group-hover:opacity-100'
            }`} />
          <MessageSquare size={28} />
          <div className="absolute left-16 z-50 scale-0 rounded-md bg-gray-900 p-2 text-xs font-bold text-white shadow-md transition-transform duration-100 group-hover:scale-100 origin-left">
            Direct Messages
          </div>
        </div>

        <div className="h-[2px] w-8 rounded-full bg-gray-800" />

        {guildsList.map((guild) => (
          <div
            key={guild.id}
            onClick={() => setCurrentGuild(guild.id)}
            className={`group relative flex h-12 w-12 cursor-pointer items-center justify-center transition-[border-radius,background-color,color,transform] duration-200 shadow-none ${currentGuild?.id === guild.id
              ? 'rounded-2xl bg-indigo-600 text-white'
              : 'rounded-3xl bg-gray-800 text-gray-400 hover:rounded-2xl hover:bg-indigo-600 hover:text-white'
              }`}
          >
            <div className={`absolute -left-4 w-1 rounded-r-full bg-white transition-[height,opacity] duration-200 ${currentView === 'chat' && currentGuild?.id === guild.id
              ? 'h-10 opacity-100'
              : 'h-0 opacity-0 group-hover:h-5 group-hover:opacity-100'
              }`} />
            <span className="text-sm font-bold uppercase">{(guild.name || 'G').substring(0, 2).toUpperCase()}</span>
            <div className="absolute left-16 z-50 scale-0 rounded-md bg-gray-900 p-2 text-xs font-bold text-white shadow-md transition-transform duration-100 group-hover:scale-100 origin-left">
              {guild.name || 'Guild'}
            </div>
          </div>
        ))}

        <div
          onClick={() => setShowCreateModal(true)}
          className="group relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-3xl bg-gray-800 text-emerald-500 transition-[border-radius,background-color,color] duration-200 shadow-none hover:rounded-2xl hover:bg-emerald-600 hover:text-white"
        >
          <Plus data-testid="Plus" size={28} />
          <div className="absolute left-16 z-50 scale-0 rounded-md bg-gray-900 p-2 text-xs font-bold text-white shadow-md transition-transform duration-100 group-hover:scale-100 origin-left">
            Add a Server
          </div>
        </div>

        <div
          onClick={() => setCurrentView('discovery')}
          className={`group relative flex h-12 w-12 cursor-pointer items-center justify-center transition-[border-radius,background-color,color] duration-200 shadow-none ${currentView === 'discovery'
            ? 'rounded-2xl bg-emerald-600 text-white'
            : 'rounded-3xl bg-gray-800 text-emerald-500 hover:rounded-2xl hover:bg-emerald-600 hover:text-white'
            }`}
        >
          <div className={`absolute -left-4 w-1 rounded-r-full bg-white transition-[height,opacity] duration-200 ${currentView === 'discovery'
            ? 'h-10 opacity-100'
            : 'h-0 opacity-0 group-hover:h-5 group-hover:opacity-100'
            }`} />
          <Compass size={28} />
          <div className="absolute left-16 z-50 scale-0 rounded-md bg-gray-900 p-2 text-xs font-bold text-white shadow-md transition-transform duration-100 group-hover:scale-100 origin-left">
            Discover Communities
          </div>
        </div>
      </div>

      <CreateGuildModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
};
