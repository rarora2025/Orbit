import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./chats.actions', () => ({
  upsertSession: vi.fn(() => Promise.resolve()),
  deleteSession: vi.fn(() => Promise.resolve()),
  listSessions: vi.fn(),
}));

import { useChatStore, buildModelHistory, type StoredMsg } from './chatStore';

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

describe('buildModelHistory', () => {
  it('keeps user turns as plain text', () => {
    const msgs: StoredMsg[] = [{ role: 'user', text: 'hi' }];
    expect(buildModelHistory(msgs)).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('records a confirmed action so the model knows it is already done', () => {
    const msgs: StoredMsg[] = [
      { role: 'user', text: "update Shayne's phone" },
      {
        role: 'assistant', id: 'a1', text: 'On it.',
        actions: [{ action: { id: 'x', type: 'update_contact', args: { contactName: 'Shayne', phone: '123' } }, summary: 'Update Shayne · phone', status: 'confirmed' }],
      },
    ];
    const h = buildModelHistory(msgs);
    expect(h[1].content).toContain('On it.');
    expect(h[1].content).toContain('already handled — DONE: Update Shayne · phone');
  });

  it('marks a still-pending action as awaiting (so it is not re-proposed)', () => {
    const msgs: StoredMsg[] = [
      { role: 'assistant', id: 'a1', text: '', actions: [{ action: { id: 'y', type: 'set_context', args: { contactName: 'Ada', context: 'x' } }, summary: 'Save context for Ada', status: 'pending' }] },
    ];
    expect(buildModelHistory(msgs)[0].content).toBe('[action already handled — AWAITING user confirmation: Save context for Ada]');
  });
});
