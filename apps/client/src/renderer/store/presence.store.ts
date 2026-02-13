import { create } from 'zustand';
import type { UserPresence } from '@ironcord/shared/types';

interface PresenceState {
  presences: Record<string, UserPresence>;
  setPresence: (nick: string, presence: UserPresence) => void;
  clearPresences: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  presences: {},
  setPresence: (nick, presence) =>
    set((state) => ({
      presences: { ...state.presences, [nick]: presence },
    })),
  clearPresences: () => set({ presences: {} }),
}));
