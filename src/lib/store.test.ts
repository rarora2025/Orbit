import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./contacts.actions', () => ({
  addContact: vi.fn(),
  updateContact: vi.fn(),
  moveContact: vi.fn(),
  deleteContact: vi.fn(),
  listContacts: vi.fn(),
}));

import { useCRMStore } from './store';
import type { Contact } from './mockData';

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
