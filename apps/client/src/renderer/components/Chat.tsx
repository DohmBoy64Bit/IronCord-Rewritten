import type { Message } from '@ironcord/shared/types';
import { Hash, Bell, Pin, Users, Search, Inbox, HelpCircle, PlusCircle, Gift, Sticker, Smile, X } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useGuildStore } from '../store/guild.store';
import { useMessageStore } from '../store/message.store';
import { usePresenceStore } from '../store/presence.store';

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

function formatMessageDate(timestamp?: string): string {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const isYesterday = date.getDate() === now.getDate() - 1 && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

const StatusIndicator: React.FC<{ status?: string }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-green-500';
      case 'idle':
      case 'away': return 'bg-amber-500';
      case 'dnd':
      case 'do not disturb': return 'bg-red-500';
      case 'invisible': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const isDND = status?.toLowerCase() === 'dnd' || status?.toLowerCase() === 'do not disturb';

  return (
    <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#1e1f22] ${getStatusColor()} flex items-center justify-center`}>
      {isDND && <div className="h-0.5 w-1.5 bg-[#1e1f22] rounded-full" />}
    </div>
  );
};

const TypingIndicator: React.FC<{ typingUsers: string[] }> = ({ typingUsers }) => {
  if (typingUsers.length === 0) return null;

  let text = '';
  if (typingUsers.length === 1) {
    text = `${typingUsers[0]} is typing...`;
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
  } else if (typingUsers.length === 3) {
    text = `${typingUsers[0]}, ${typingUsers[1]}, and ${typingUsers[2]} are typing...`;
  } else {
    text = 'Several people are typing...';
  }

  return (
    <div className="absolute bottom-full left-4 mb-2 text-xs font-bold text-gray-400 animate-pulse">
      {text}
    </div>
  );
};

export const Chat: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const currentGuildId = useGuildStore((state) => state.currentGuildId);
  const channels = useGuildStore((state) => state.channels);
  const currentChannelId = useGuildStore((state) => state.currentChannelId);
  const members = useGuildStore((state) => state.members);
  const messages = useMessageStore((state) => state.messages);
  const presences = usePresenceStore((state) => state.presences);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMemberList, setShowMemberList] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastTypedRef = useRef<number>(0);

  const channelsMap = channels && typeof channels === 'object' ? channels : {};
  const messagesMap = messages && typeof messages === 'object' ? messages : {};
  const membersMap = members && typeof members === 'object' ? members : {};

  const guildChannels = currentGuildId ? channelsMap[currentGuildId] || [] : [];
  const currentChannel = guildChannels.find(c => c.id === currentChannelId);
  const channelMessages = currentChannel?.irc_channel_name ? messagesMap[currentChannel.irc_channel_name] || [] : [];
  const currentMembers = currentChannel?.irc_channel_name ? membersMap[currentChannel.irc_channel_name] || [] : [];
  const filteredMessages = searchQuery
    ? channelMessages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : channelMessages;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages]);

  useEffect(() => {
    const handleTypingEvent = (data: { nick: string; target: string; status: 'active' | 'paused' | 'done' }) => {
      if (!currentChannel || data.target !== currentChannel.irc_channel_name) return;
      if (data.nick === user?.irc_nick) return;

      setTypingUsers(prev => {
        const next = new Map(prev);
        if (data.status === 'active') {
          next.set(data.nick, Date.now());
        } else {
          next.delete(data.nick);
        }
        return next;
      });
    };

    window.ironcord.onIRCTyping(handleTypingEvent);

    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        let changed = false;
        const next = new Map(prev);
        for (const [nick, time] of next.entries()) {
          if (now - time > 6000) {
            next.delete(nick);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentChannel, user?.irc_nick]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (currentChannel) {
      const now = Date.now();
      if (now - lastTypedRef.current > 3000) {
        window.ironcord.sendTyping(currentChannel.irc_channel_name, 'active');
        lastTypedRef.current = now;
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentChannel) return;

    try {
      await window.ironcord.sendMessage(currentChannel.irc_channel_name, input);
      window.ironcord.sendTyping(currentChannel.irc_channel_name, 'done');
      lastTypedRef.current = 0;
      setInput('');
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as unknown as React.FormEvent);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      showToast(`Selected ${file.name} — Uploading...`);
      setTimeout(() => {
        showToast(`${file.name} successfully uploaded.`);
      }, 2000);
    }
  };

  const showToast = useCallback((feature: string) => {
    setToast(`${feature} will be available in the full release.`);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const handleGlobalToast = (e: CustomEvent) => {
      if (e.detail) showToast(e.detail);
    };
    window.addEventListener('show-toast', handleGlobalToast as EventListener);
    return () => window.removeEventListener('show-toast', handleGlobalToast as EventListener);
  }, [showToast]);

  if (!currentChannel) {
    return (
      <div className="glass-panel flex flex-1 flex-col bg-transparent backdrop-blur-md rounded-r-lg my-1 mr-1 h-[calc(100%-8px)] border-l-0">
        <div className="flex h-12 items-center border-b border-gray-950 px-4 shadow-xs">
          <Hash size={24} className="mr-2 text-gray-500" />
          <span className="font-bold text-white">Select a channel</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h3 className="text-xl font-bold text-white">Welcome, {user?.irc_nick || 'Traveller'}!</h3>
            <p className="text-gray-400">Select a channel to start chatting</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel flex flex-1 flex-col bg-transparent backdrop-blur-md rounded-r-lg my-1 mr-1 h-[calc(100%-8px)] border-l-0">
      {toast && (
        <div className="absolute top-16 right-4 z-50 rounded-lg bg-gray-900 px-4 py-2 text-sm text-gray-300 shadow-lg border border-gray-700">
          {toast}
        </div>
      )}

      <div className="flex h-12 items-center justify-between border-b border-gray-950 px-4 shadow-xs">
        <div className="flex items-center">
          <Hash size={24} className="mr-2 text-gray-500" />
          <span className="font-bold text-white">{currentChannel.name}</span>
        </div>
        <div className="flex items-center space-x-4 text-gray-400">
          <Bell size={20} className="cursor-pointer hover:text-gray-200" onClick={() => showToast('Notifications')} />
          <Pin data-testid="Pin" size={20} className="cursor-pointer hover:text-gray-200" onClick={() => showToast('Pinned Messages')} />
          <Users data-testid="Users" size={20} className={`cursor-pointer hover:text-gray-200 ${showMemberList ? 'text-white' : ''}`} onClick={() => setShowMemberList(!showMemberList)} />
          <div className="flex h-6 w-36 items-center rounded bg-gray-950 px-1 text-xs">
            <input
              type="text"
              placeholder="Search"
              ref={searchInputRef}
              className="w-full bg-transparent px-1 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? <X size={14} className="cursor-pointer" onClick={() => setSearchQuery('')} /> : <Search size={14} className="cursor-pointer" onClick={() => searchInputRef.current?.focus()} />}
          </div>
          <Inbox size={20} className="cursor-pointer hover:text-gray-200" onClick={() => showToast('Inbox')} />
          <HelpCircle size={20} className="cursor-pointer hover:text-gray-200" onClick={() => showToast('Help')} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {(searchQuery ? filteredMessages : channelMessages).length === 0 && (
              <div className="mb-8 mt-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-700 text-white">
                  <Hash size={40} />
                </div>
                <h1 className="mt-4 text-3xl font-bold text-white">
                  {searchQuery ? `No results for "${searchQuery}"` : `Welcome to #${currentChannel.name}!`}
                </h1>
                <p className="text-gray-400">
                  {searchQuery ? "Try a different search term." : `This is the start of the #${currentChannel.name} channel.`}
                </p>
              </div>
            )}

            {(searchQuery ? filteredMessages : channelMessages).map((msg: Message, i: number) => (
              <div key={msg.id || i} className="group flex items-start space-x-4 hover:bg-gray-900/20 -mx-4 px-4 py-1">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full mt-1 ${nickColor(msg.author)}`}>
                  <span className="text-sm font-bold text-white uppercase">{msg.author.charAt(0)}</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-baseline space-x-2">
                    <span className="font-medium text-white hover:underline cursor-pointer">{msg.author}</span>
                    <span className="text-[10px] text-gray-400">
                      {formatMessageDate(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-gray-300 leading-snug">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-6 relative">
            <TypingIndicator typingUsers={Array.from(typingUsers.keys())} />
            {showEmojiPicker && (
              <div className="glass-panel absolute bottom-20 right-4 z-50 rounded-lg bg-black/80 backdrop-blur-xl p-3 shadow-2xl border-gray-700 w-64">
                <div className="grid grid-cols-6 gap-2">
                  {['😀', '😂', '😍', '👍', '🔥', '✨', '🚀', '🎉', '💡', '💯', '👋', '👀', '❤️', '🤔', '😎', '🙌', '⭐'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiClick(emoji)}
                      className="text-2xl hover:bg-gray-700 rounded p-1 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="glass-panel flex items-center rounded-lg bg-black/50 px-4 py-2 border-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <PlusCircle
                size={24}
                className="mr-4 cursor-pointer text-gray-400 hover:text-gray-200"
                onClick={() => fileInputRef.current?.click()}
              />
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${currentChannel.name}`}
                className="flex-1 bg-transparent py-2 text-gray-200 outline-none placeholder-gray-500"
              />
              <button type="submit" className="hidden" aria-hidden="true" />
              <div className="ml-4 flex items-center space-x-3 text-gray-400">
                <Gift size={24} className="cursor-pointer hover:text-gray-200" onClick={() => showToast('Gifts')} />
                <Sticker size={24} className="cursor-pointer hover:text-gray-200" onClick={() => showToast('Stickers')} />
                <Smile
                  size={24}
                  className={`cursor-pointer hover:text-gray-200 ${showEmojiPicker ? 'text-white' : ''}`}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                />
              </div>
            </form>
          </div>
        </div>

        {showMemberList && (
          <div className="glass-panel w-60 bg-black/20 backdrop-blur-md border-l border-white/5 p-4 overflow-y-auto my-1 mr-1 rounded-r-lg border-y-0 border-r-0 h-[calc(100vh-8px)]">
            <h3 className="text-xs font-bold uppercase text-gray-400 mb-4">Online — {currentMembers.length}</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 p-2 hover:bg-gray-700 rounded-md cursor-pointer transition-colors group">
                <div className="relative">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${nickColor(user?.irc_nick || 'Unknown User')}`}>
                    <span className="text-xs font-bold text-white uppercase">{user?.irc_nick?.[0] || '?'}</span>
                  </div>
                  <StatusIndicator status={presences[user?.irc_nick || ''] || 'online'} />
                </div>
                <span className="text-sm text-gray-300 group-hover:text-white font-medium">{user?.irc_nick || 'Unknown User'} (You)</span>
              </div>

              {currentMembers.filter(name => name !== user?.irc_nick).map(name => (
                <div key={name} className="flex items-center space-x-2 p-2 hover:bg-gray-700 rounded-md cursor-pointer transition-colors group">
                  <div className="relative">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${nickColor(name)}`}>
                      <span className="text-xs font-bold text-white uppercase">{name[0]}</span>
                    </div>
                    <StatusIndicator status={presences[name] || 'online'} />
                  </div>
                  <span className="text-sm text-gray-400 group-hover:text-white font-medium">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
