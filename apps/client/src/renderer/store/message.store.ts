import type { Message } from '@ironcord/shared/types';
import { create } from 'zustand';

interface MessageState {
  messages: Record<string, Message[]>;
  addMessage: (channelId: string, message: Message) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  clearMessages: (channelId: string) => void;
  addReaction: (channelId: string, msgId: string, reaction: string, nick: string) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: {},
  addMessage: (channelId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: [...(state.messages[channelId] || []), message],
      },
    })),
  setMessages: (channelId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [channelId]: messages },
    })),
  clearMessages: (channelId) =>
    set((state) => ({
      messages: { ...state.messages, [channelId]: [] },
    })),
  addReaction: (channelId, msgId, reaction, nick) =>
    set((state) => {
      const channelMessages = state.messages[channelId] || [];
      const messageIndex = channelMessages.findIndex(m => m.id === msgId);

      if (messageIndex === -1) return state;

      const message = channelMessages[messageIndex];
      const currentReactions = message.reactions || {};
      const reactors = currentReactions[reaction] || [];

      // Avoid duplicates if same user reacts same emoji (though some IRCds might allow it, usually UI dedupes)
      if (reactors.includes(nick)) return state;

      const newReactions = {
        ...currentReactions,
        [reaction]: [...reactors, nick]
      };

      const newMessages = [...channelMessages];
      newMessages[messageIndex] = {
        ...message,
        reactions: newReactions
      };

      return {
        messages: {
          ...state.messages,
          [channelId]: newMessages
        }
      };
    }),
}));
