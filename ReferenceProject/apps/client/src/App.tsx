import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import Login from './components/Login';
import Register from './components/Register';
import Sidebar from './components/Sidebar';
import ChannelList from './components/ChannelList';
import Chat from './components/Chat';
import TitleBar from './components/TitleBar';

const App: React.FC = () => {
  const [view, setView] = useState<'login' | 'register'>('login');
  const { user, setUser, setGuilds, addMessage, setMessages, setMembers } = useStore();

  useEffect(() => {
    if (user) {
      window.ironcord.log('APP', {
        event: 'user_bootstrap',
        userId: user.id,
        email: user.email,
        irc_nick: user.irc_nick,
      });

      // 1. Fetch guilds (no userId needed — token-based)
      window.ironcord.getMyGuilds().then((guilds: any) => {
        window.ironcord.log('APP', {
          event: 'getMyGuilds_resolved',
          count: Array.isArray(guilds) ? guilds.length : null,
        });
        setGuilds(guilds);
      });

      // 2. Connect to IRC via Gateway
      const ircHost = process.env.VITE_IRC_HOST || 'localhost';
      const ircPort = parseInt(process.env.VITE_IRC_PORT || '6667', 10);

      window.ironcord.log('APP', {
        event: 'calling_connectIRC',
        userId: user.id,
        host: ircHost,
        port: ircPort,
        nick: user.irc_nick,
      });

      window.ironcord.connectIRC(user.id, {
        host: ircHost,
        port: ircPort,
        nick: user.irc_nick,
        username: user.irc_nick,
        realname: user.irc_nick,
      });

      // 3. Setup event listeners
      window.ironcord.onIRCMessage((msg: any) => {
        window.ironcord.log('APP', { event: 'onIRCMessage', msg });
        addMessage(msg.channel, {
          id: msg.id, // Now provided by server
          channel: msg.channel,
          author: msg.author,
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
        });
      });

      // 4. Handle chat history replay
      window.ironcord.onIRCHistory((historyMessages: any[]) => {
        if (!historyMessages || historyMessages.length === 0) return;

        window.ironcord.log('APP', {
          event: 'onIRCHistory',
          count: historyMessages.length,
        });

        const channel = historyMessages[0].channel;
        const formatted = historyMessages.map((msg: any) => ({
          id: msg.id, // Use server ID
          channel: msg.channel,
          author: msg.author,
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
        }));
        setMessages(channel, formatted);
      });

      window.ironcord.onIRCConnected(() => {
        window.ironcord.log('APP', { event: 'onIRCConnected' });
      });

      window.ironcord.onIRCRegistered(() => {
        window.ironcord.log('APP', { event: 'onIRCRegistered' });
      });

      window.ironcord.onIRCError((err: any) => {
        window.ironcord.log('APP', { event: 'onIRCError', err });
      });

      window.ironcord.onIRCMembers((data: { channel: string; members: string[] }) => {
        window.ironcord.log('APP', { event: 'onIRCMembers', data });
        setMembers(data.channel, data.members);
      });

      window.ironcord.onIRCPresence((data: { nick: string; status: 'online' | 'away'; message?: string }) => {
        window.ironcord.log('APP', { event: 'onIRCPresence', data });
        // @ts-ignore - store implementation updated
        useStore.getState().setPresence(data.nick, data.status, data.message);
      });
    }
  }, [user]);

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

export default App;
