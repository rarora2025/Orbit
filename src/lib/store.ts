'use client';

import { create } from 'zustand';
import type { Contact } from './contact';
import { sortByPosition } from './position';

interface CRMStore {
  contacts: Contact[];
  loaded: boolean;
  selectedContactId: string | null;
  setContacts: (contacts: Contact[]) => void;
  applyAdded: (contact: Contact) => void;
  applyUpdated: (contact: Contact) => void;
  applyRemoved: (id: string) => void;
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>()((set) => ({
  contacts: [],
  loaded: false,
  selectedContactId: null,
  setContacts: (contacts) => set({ contacts: sortByPosition(contacts), loaded: true }),
  applyAdded: (contact) =>
    set((s) => ({ contacts: sortByPosition([...s.contacts, contact]) })),
  applyUpdated: (contact) =>
    set((s) => ({ contacts: sortByPosition(s.contacts.map((c) => (c.id === contact.id ? contact : c))) })),
  applyRemoved: (id) =>
    set((s) => ({
      contacts: s.contacts.filter((c) => c.id !== id),
      selectedContactId: s.selectedContactId === id ? null : s.selectedContactId,
    })),
  selectContact: (id) => set({ selectedContactId: id }),
}));
