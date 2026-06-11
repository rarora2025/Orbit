import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./contacts.actions', () => ({
  addContact: vi.fn(),
  updateContact: vi.fn(),
  moveContact: vi.fn(),
  deleteContact: vi.fn(),
  listContacts: vi.fn(),
  addDraftInteraction: vi.fn(),
  markMessageSent: vi.fn(),
}));

import { useCRMStore } from './store';
import type { Contact } from './mockData';
import * as api from './contacts.actions';

function c(id: string, status: Contact['status'], position: number): Contact {
  return {
    id, position, name: id, company: '', role: '', linkedinUrl: '', email: '',
    inquiry: '', notes: '', status, priority: 'Medium', score: 0, warmth: 'Medium',
    avatarColor: '', tags: [], lastContacted: '', nextAction: '', aiSummary: '',
    outreachAngle: '', suggestedMessage: '', interactions: [],
  };
}

beforeEach(() => {
  useCRMStore.setState({ contacts: [], selectedContactId: null, loaded: false });
});

describe('useCRMStore hydration', () => {
  it('setContacts sorts by position and marks loaded', () => {
    useCRMStore.getState().setContacts([c('b', 'Send', 2000), c('a', 'Send', 1000)]);
    expect(useCRMStore.getState().contacts.map((x) => x.id)).toEqual(['a', 'b']);
    expect(useCRMStore.getState().loaded).toBe(true);
  });

  it('selectContact toggles the selection', () => {
    useCRMStore.getState().selectContact('a');
    expect(useCRMStore.getState().selectedContactId).toBe('a');
  });
});

describe('useCRMStore interactions', () => {
  it('markSent upserts the returned contact (moving it to Pending)', async () => {
    const moved = c('a', 'Pending', 1000);
    (api.markMessageSent as ReturnType<typeof vi.fn>).mockResolvedValue(moved);
    useCRMStore.setState({ contacts: [c('a', 'Send', 1000)], loaded: true });
    await useCRMStore.getState().markSent('a', { channel: 'Email', content: 'hi' });
    expect(useCRMStore.getState().contacts.find((x) => x.id === 'a')?.status).toBe('Pending');
  });

  it('saveDraft upserts the returned contact without changing status', async () => {
    const withDraft = c('a', 'Send', 1000);
    withDraft.interactions = [{ id: 'i1', date: '2026-06-11', type: 'message_drafted', content: 'draft' }];
    (api.addDraftInteraction as ReturnType<typeof vi.fn>).mockResolvedValue(withDraft);
    useCRMStore.setState({ contacts: [c('a', 'Send', 1000)], loaded: true });
    await useCRMStore.getState().saveDraft('a', { channel: 'Email', content: 'draft' });
    const updated = useCRMStore.getState().contacts.find((x) => x.id === 'a');
    expect(updated?.status).toBe('Send');
    expect(updated?.interactions).toHaveLength(1);
  });
});
