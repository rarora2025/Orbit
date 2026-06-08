'use client';

import { create } from 'zustand';
import { Contact, Status } from './mockData';
import { appendPosition, positionBefore, sortByPosition } from './position';

interface CRMStore {
  contacts: Contact[];
  loaded: boolean;
  selectedContactId: string | null;
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  moveContact: (id: string, toStatus: Status, beforeId: string | null) => void;
  deleteContact: (id: string) => void;
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>()((set) => ({
  contacts: [],
  loaded: false,
  selectedContactId: null,
  setContacts: (contacts) => set({ contacts: sortByPosition(contacts), loaded: true }),
  addContact: (contact) =>
    set((s) => ({
      contacts: sortByPosition([
        ...s.contacts,
        { ...contact, position: appendPosition(s.contacts, contact.status) },
      ]),
    })),
  updateContact: (id, updates) =>
    set((s) => ({
      contacts: sortByPosition(
        s.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      ),
    })),
  moveContact: (id, toStatus, beforeId) =>
    set((s) => {
      const moving = s.contacts.find((c) => c.id === id);
      if (!moving) return {};
      const position = positionBefore(s.contacts, toStatus, beforeId, id);
      return {
        contacts: sortByPosition(
          s.contacts.map((c) => (c.id === id ? { ...c, status: toStatus, position } : c)),
        ),
      };
    }),
  deleteContact: (id) =>
    set((s) => ({
      contacts: s.contacts.filter((c) => c.id !== id),
      selectedContactId: s.selectedContactId === id ? null : s.selectedContactId,
    })),
  selectContact: (id) => set({ selectedContactId: id }),
}));
