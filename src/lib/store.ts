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
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>()((set, get) => {
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
    selectContact: (id) => set({ selectedContactId: id }),
  };
});
