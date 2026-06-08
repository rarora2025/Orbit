'use client';

import { create } from 'zustand';
import { Contact, mockContacts, Status, Priority } from './mockData';

interface CRMStore {
  contacts: Contact[];
  selectedContactId: string | null;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>((set) => ({
  contacts: mockContacts,
  selectedContactId: null,
  addContact: (contact) =>
    set((state) => ({ contacts: [...state.contacts, contact] })),
  updateContact: (id, updates) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  deleteContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
      selectedContactId: state.selectedContactId === id ? null : state.selectedContactId,
    })),
  selectContact: (id) => set({ selectedContactId: id }),
}));
