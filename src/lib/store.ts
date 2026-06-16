'use client';

import { create } from 'zustand';
import { Contact, Status } from './mockData';
import { sortByPosition } from './position';
import * as api from './contacts.actions';

interface CRMStore {
  contacts: Contact[];
  loaded: boolean;
  selectedContactId: string | null;
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => Promise<void>;
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
  moveContact: (id: string, toStatus: Status, beforeId: string | null) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  saveDraft: (contactId: string, input: { channel: string; content: string }) => Promise<void>;
  markSent: (contactId: string, input: { channel: string; content: string }) => Promise<void>;
  logResponse: (contactId: string, input: { content: string; nextStep?: string }) => Promise<void>;
  scheduleMeeting: (contactId: string, input: { date: string; time: string; notes: string }) => Promise<void>;
  markMet: (contactId: string, input: { notes: string; followUpAt?: string }) => Promise<void>;
  setFollowUp: (contactId: string, input: { date: string; reason?: string }) => Promise<void>;
  clearFollowUp: (contactId: string) => Promise<void>;
  moveToLongTerm: (contactId: string) => Promise<void>;
  markGhosted: (contactId: string) => Promise<void>;
  setStatus: (contactId: string, toStatus: Status) => Promise<void>;
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>()((set) => {
  const upsertLocal = (contact: Contact) =>
    set((s) => ({
      contacts: sortByPosition([
        ...s.contacts.filter((c) => c.id !== contact.id),
        contact,
      ]),
    }));

  return {
    contacts: [],
    loaded: false,
    selectedContactId: null,
    setContacts: (contacts) => set({ contacts: sortByPosition(contacts), loaded: true }),
    addContact: async (contact) => { upsertLocal(await api.addContact(contact)); },
    updateContact: async (id, updates) => { upsertLocal(await api.updateContact(id, updates)); },
    moveContact: async (id, toStatus, beforeId) => { upsertLocal(await api.moveContact(id, toStatus, beforeId)); },
    deleteContact: async (id) => {
      await api.deleteContact(id);
      set((s) => ({
        contacts: s.contacts.filter((c) => c.id !== id),
        selectedContactId: s.selectedContactId === id ? null : s.selectedContactId,
      }));
    },
    saveDraft: async (contactId, input) => { upsertLocal(await api.addDraftInteraction(contactId, input)); },
    markSent: async (contactId, input) => { upsertLocal(await api.markMessageSent(contactId, input)); },
    logResponse: async (contactId, input) => { upsertLocal(await api.logResponse(contactId, input)); },
    scheduleMeeting: async (contactId, input) => { upsertLocal(await api.scheduleMeeting(contactId, input)); },
    markMet: async (contactId, input) => { upsertLocal(await api.markMet(contactId, input)); },
    setFollowUp: async (contactId, input) => { upsertLocal(await api.setFollowUp(contactId, input)); },
    clearFollowUp: async (contactId) => { upsertLocal(await api.clearFollowUp(contactId)); },
    moveToLongTerm: async (contactId) => { upsertLocal(await api.changeStatusLogged(contactId, 'Long-term', 'Moved to long-term')); },
    markGhosted: async (contactId) => { upsertLocal(await api.changeStatusLogged(contactId, 'Ghosted', 'Marked as ghosted')); },
    setStatus: async (contactId, toStatus) => { upsertLocal(await api.changeStatusLogged(contactId, toStatus, `Moved to ${toStatus}`)); },
    selectContact: (id) => set({ selectedContactId: id }),
  };
});
