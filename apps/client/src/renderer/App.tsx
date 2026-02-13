import React, { useState, useEffect } from 'react';
import { useAuthStore } from './store/auth.store';
import { useGuildStore } from './store/guild.store';
import { useMessageStore } from './store/message.store';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Sidebar } from './components/Sidebar';
import { ChannelList } from './components/ChannelList';
import { Chat } from './components/Chat';
import { TitleBar } from './components/TitleBar';
import type { Guild, Message } from '@ironcord/shared/types';

export const App: React.FC = () => {
  const [view, setView] = useState<'login' | 'register'>('login');
  const { user } = useAuthStore();
  const { setGuilds } = useGuildStore();
  const { addMessage, setMessages } = useMessageStore();

  useEffect(() => {
    if (user) {
      window.ironcord.getMyGuilds().then((guilds: Guild[]) => {
        setGuilds(guilds);
      });

      window.ironcord.onIRCMessage((msg: Message) => {
        addMessage(msg.channel, msg);
      });

      window.ironcord.onIRCHistory((historyMessages: Message[]) => {
        if (!historyMessages || historyMessages.length === 0) return;
        const channel = historyMessages[0].channel;
        setMessages(channel, historyMessages);
      });
    }
  }, [user, setGuilds, addMessage, setMessages]);

  return (
    <div className="flex h-screen flex-col bg-gray-900 overflow-hidden select-none">
      <TitleBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!user ? (
          view === 'login' ? (
            <Login onSwitch={() => setView('register')} />
          ) : (
            <Register onSwitch={() => setView('login')} />
          )
        ) : (
          <>
            <Sidebar />
            <ChannelList />
            <Chat />
          </>
        )}
      </div>
    </div>
  );
};
