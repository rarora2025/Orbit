'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Messages store contact *ids* (not full objects) so they stay in sync with the
// CRM store and survive serialization; the UI re-resolves them at render time.
export type StoredMsg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; contactIds?: string[]; followups?: string[] };

export interface ChatSession {
  id: string;
  title: string;
  messages: StoredMsg[];
  updatedAt: number;
}

interface ChatStore {
  sessions: ChatSession[];
  activeId: string | null;
  newChat: () => void;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  /** Appends to the active session, creating one if needed. Returns its id. */
  addUserMessage: (text: string) => string;
  addAssistantMessage: (sessionId: string, msg: Extract<StoredMsg, { role: 'assistant' }>) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,
      newChat: () => set({ activeId: null }),
      selectChat: (id) => set({ activeId: id }),
      deleteChat: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((x) => x.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      addUserMessage: (text) => {
        const s = get();
        const existing = s.activeId && s.sessions.find((x) => x.id === s.activeId);
        if (existing) {
          set({
            sessions: s.sessions.map((x) =>
              x.id === existing.id
                ? { ...x, messages: [...x.messages, { role: 'user', text }], updatedAt: Date.now() }
                : x,
            ),
          });
          return existing.id;
        }
        const id = Date.now().toString();
        const session: ChatSession = {
          id,
          title: text.length > 40 ? text.slice(0, 40).trimEnd() + '…' : text,
          messages: [{ role: 'user', text }],
          updatedAt: Date.now(),
        };
        set({ sessions: [session, ...s.sessions], activeId: id });
        return id;
      },
      addAssistantMessage: (sessionId, msg) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId ? { ...x, messages: [...x.messages, msg], updatedAt: Date.now() } : x,
          ),
        })),
    }),
    { name: 'orbit-chats', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
