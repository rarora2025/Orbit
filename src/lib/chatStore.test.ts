import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./chats.actions', () => ({
  upsertSession: vi.fn(() => Promise.resolve()),
  deleteSession: vi.fn(() => Promise.resolve()),
  listSessions: vi.fn(),
}));

import { useChatStore } from './chatStore';

beforeEach(() => {
  useChatStore.setState({ sessions: [], activeId: null });
});

describe('useChatStore (in-memory)', () => {
  it('setSessions hydrates the list', () => {
    useChatStore.getState().setSessions([
      { id: '1', title: 'Hi', messages: [], updatedAt: 1 },
    ]);
    expect(useChatStore.getState().sessions).toHaveLength(1);
  });

  it('addUserMessage creates a session and returns its id', () => {
    const id = useChatStore.getState().addUserMessage('first message');
    const s = useChatStore.getState().sessions.find(x => x.id === id)!;
    expect(s.messages).toEqual([{ role: 'user', text: 'first message' }]);
    expect(useChatStore.getState().activeId).toBe(id);
  });

  it('addUserMessage appends to the active session', () => {
    const id = useChatStore.getState().addUserMessage('one');
    const id2 = useChatStore.getState().addUserMessage('two');
    expect(id2).toBe(id);
    expect(useChatStore.getState().sessions[0].messages).toHaveLength(2);
  });
});
