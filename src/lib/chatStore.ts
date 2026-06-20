'use client';

import { create } from 'zustand';
import * as api from './chats.actions';
import type { ProposedAction } from './chat/tools';

/** A proposed action attached to an assistant message, with its confirm state. */
export interface StoredAction {
  action: ProposedAction;
  summary: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed';
  /** Receipt or error text shown once resolved. */
  receipt?: string;
  /** For draft_message: the generated draft, shown for Save / Mark sent. */
  draft?: string;
  draftContactId?: string;
}

// Messages store contact *ids* (not full objects) so they stay in sync with the
// CRM store and survive serialization; the UI re-resolves them at render time.
export type StoredMsg =
  | { role: 'user'; text: string }
  | {
      role: 'assistant';
      text: string;
      /** Stable id so action state can be updated after the message is stored. */
      id?: string;
      contactIds?: string[];
      followups?: string[];
      actions?: StoredAction[];
    };

export interface ChatSession {
  id: string;
  title: string;
  messages: StoredMsg[];
  updatedAt: number;
}

/**
 * Flatten stored messages into the {role, content} history the model sees.
 *
 * Crucially, each assistant message's actions are appended as bracketed records
 * with their outcome. Without this the model only sees the plain text of past
 * turns, so a request like "update Shayne's phone" stays visible with no sign it
 * was handled — and the model re-proposes the same action on later turns (the
 * duplicate-approval bug). The records tell it those actions are already done /
 * declined / awaiting, so it never repeats them.
 */
export function buildModelHistory(messages: StoredMsg[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages.map((m) => {
    if (m.role === 'user') return { role: 'user' as const, content: m.text };
    const records = (m.actions ?? []).map((a) => {
      const tag =
        a.status === 'confirmed' ? 'DONE'
        : a.status === 'cancelled' ? 'DECLINED by user'
        : a.status === 'failed' ? 'FAILED'
        : 'AWAITING user confirmation';
      return `[action already handled — ${tag}: ${a.summary}]`;
    });
    return { role: 'assistant' as const, content: [m.text, ...records].filter(Boolean).join('\n') };
  });
}

interface ChatStore {
  sessions: ChatSession[];
  activeId: string | null;
  setSessions: (sessions: ChatSession[]) => void;
  newChat: () => void;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  /** Appends to the active session, creating one if needed. Returns its id. */
  addUserMessage: (text: string) => string;
  addAssistantMessage: (sessionId: string, msg: Extract<StoredMsg, { role: 'assistant' }>) => void;
  /** Replace the actions on a stored assistant message (by its stable id). */
  updateMessageActions: (sessionId: string, messageId: string, actions: StoredAction[]) => void;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  sessions: [],
  activeId: null,
  setSessions: (sessions) => set({ sessions }),
  newChat: () => set({ activeId: null }),
  selectChat: (id) => set({ activeId: id }),
  deleteChat: (id) => {
    set((s) => ({
      sessions: s.sessions.filter((x) => x.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    }));
    void api.deleteSession(id).catch(console.error);
  },
  addUserMessage: (text) => {
    const s = get();
    const existing = s.activeId ? s.sessions.find((x) => x.id === s.activeId) : undefined;
    if (existing) {
      const updated = { ...existing, messages: [...existing.messages, { role: 'user' as const, text }], updatedAt: Date.now() };
      set({ sessions: s.sessions.map((x) => (x.id === existing.id ? updated : x)) });
      void api.upsertSession(updated).catch(console.error);
      return existing.id;
    }
    const id = crypto.randomUUID();
    const session: ChatSession = {
      id,
      title: text.length > 40 ? text.slice(0, 40).trimEnd() + '…' : text,
      messages: [{ role: 'user', text }],
      updatedAt: Date.now(),
    };
    set({ sessions: [session, ...s.sessions], activeId: id });
    void api.upsertSession(session).catch(console.error);
    return id;
  },
  addAssistantMessage: (sessionId, msg) => {
    const updated = get().sessions
      .map((x) => (x.id === sessionId ? { ...x, messages: [...x.messages, msg], updatedAt: Date.now() } : x))
      .find((x) => x.id === sessionId);
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId ? { ...x, messages: [...x.messages, msg], updatedAt: Date.now() } : x,
      ),
    }));
    if (updated) void api.upsertSession(updated).catch(console.error);
  },
  updateMessageActions: (sessionId, messageId, actions) => {
    const patchSession = (session: ChatSession): ChatSession => ({
      ...session,
      messages: session.messages.map((m) =>
        m.role === 'assistant' && m.id === messageId ? { ...m, actions } : m,
      ),
      updatedAt: Date.now(),
    });
    const updated = get().sessions.find((x) => x.id === sessionId);
    if (!updated) return;
    const next = patchSession(updated);
    set((s) => ({ sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)) }));
    void api.upsertSession(next).catch(console.error);
  },
}));
