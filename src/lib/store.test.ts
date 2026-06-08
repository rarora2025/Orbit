import { describe, it, expect, beforeEach } from 'vitest';
import { useCRMStore } from './store';
import type { Contact } from './contact';

function c(id: string, status: Contact['status'], position: number): Contact {
  return { id, name: id, company: '', status, score: 0, temperature: 'Medium', tags: [], position };
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

  it('applyAdded appends and re-sorts', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000)]);
    useCRMStore.getState().applyAdded(c('b', 'Send', 500));
    expect(useCRMStore.getState().contacts.map(x => x.id)).toEqual(['b', 'a']);
  });

  it('applyRemoved drops the contact and clears selection', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000)]);
    useCRMStore.setState({ selectedContactId: 'a' });
    useCRMStore.getState().applyRemoved('a');
    expect(useCRMStore.getState().contacts).toEqual([]);
    expect(useCRMStore.getState().selectedContactId).toBeNull();
  });
});
