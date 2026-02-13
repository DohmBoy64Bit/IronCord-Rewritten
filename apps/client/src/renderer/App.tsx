import type { Guild, Message } from '@ironcord/shared/types';
import React, { useState, useEffect } from 'react';
import { ChannelList } from './components/ChannelList';
import { Chat } from './components/Chat';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { useAuthStore } from './store/auth.store';
import { useGuildStore } from './store/guild.store';
import { useMessageStore } from './store/message.store';

export const App: React.FC = () => {
  const [view, setView] = useState<'login' | 'register'>('login');
  const user = useAuthStore((state) => state.user);
  const setGuilds = useGuildStore((state) => state.setGuilds);
  const addMessage = useMessageStore((state) => state.addMessage);
  const setMessages = useMessageStore((state) => state.setMessages);

  useEffect(() => {
    if (user) {
      const token = useAuthStore.getState().token;
      if (token) {
        window.ironcord.connectIRC(user.id, token);
      }

      window.ironcord.getMyGuilds().then((guilds: Guild[]) => {
        setGuilds(guilds);
      }).catch((err) => {
        console.error('Failed to load guilds:', err);
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
