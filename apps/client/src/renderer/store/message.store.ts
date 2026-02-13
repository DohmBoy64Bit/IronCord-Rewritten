import type { Message } from '@ironcord/shared/types';
import { create } from 'zustand';

interface MessageState {
  messages: Record<string, Message[]>;
  addMessage: (channelId: string, message: Message) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  clearMessages: (channelId: string) => void;
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
}));
