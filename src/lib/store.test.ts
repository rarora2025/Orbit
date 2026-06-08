import { describe, it, expect, beforeEach } from 'vitest';
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

describe('useCRMStore (in-memory)', () => {
  it('setContacts sorts by position and marks loaded', () => {
    useCRMStore.getState().setContacts([c('b', 'Send', 2000), c('a', 'Send', 1000)]);
    expect(useCRMStore.getState().contacts.map(x => x.id)).toEqual(['a', 'b']);
    expect(useCRMStore.getState().loaded).toBe(true);
  });

  it('addContact appends after the last card in its column', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000)]);
    useCRMStore.getState().addContact(c('b', 'Send', 0));
    const b = useCRMStore.getState().contacts.find(x => x.id === 'b')!;
    expect(b.position).toBe(2000);
  });

  it('moveContact repositions between neighbours and updates status', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000), c('b', 'Send', 2000)]);
    useCRMStore.getState().moveContact('b', 'Send', 'a');
    const b = useCRMStore.getState().contacts.find(x => x.id === 'b')!;
    expect(b.position).toBe(500);
  });

  it('deleteContact drops the contact and clears selection', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000)]);
    useCRMStore.setState({ selectedContactId: 'a' });
    useCRMStore.getState().deleteContact('a');
    expect(useCRMStore.getState().contacts).toEqual([]);
    expect(useCRMStore.getState().selectedContactId).toBeNull();
  });
});
