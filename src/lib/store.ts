'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Contact, mockContacts, Status, Priority, Warmth } from './mockData';

// Maps statuses from earlier versions onto the current four-status model so
// contacts already saved in localStorage don't vanish (or crash the board).
const LEGACY_STATUS_MAP: Record<string, Status> = {
  'To Send': 'Send',
  'Responded': 'Response',
  'Meeting': 'Response',
  'Closed': 'Response',
};

// Maps the old warmth scale (Cool/Warm/Hot) onto the new Low/Medium/High one.
const LEGACY_WARMTH_MAP: Record<string, Warmth> = {
  'Cool': 'Low',
  'Warm': 'Medium',
  'Hot': 'High',
};

function normalizeStatus(status: string): Status {
  return LEGACY_STATUS_MAP[status] ?? (status as Status);
}

function normalizeWarmth(warmth: string): Warmth {
  return LEGACY_WARMTH_MAP[warmth] ?? (warmth as Warmth);
}

interface CRMStore {
  contacts: Contact[];
  selectedContactId: string | null;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  moveContact: (id: string, toStatus: Status, beforeId: string | null) => void;
  deleteContact: (id: string) => void;
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>()(
  persist(
    (set) => ({
      contacts: mockContacts,
      selectedContactId: null,
      addContact: (contact) =>
        set((state) => ({ contacts: [...state.contacts, contact] })),
      updateContact: (id, updates) =>
        set((state) => ({
          contacts: state.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      moveContact: (id, toStatus, beforeId) =>
        set((state) => {
          if (beforeId === id) return {};
          const moving = state.contacts.find((c) => c.id === id);
          if (!moving) return {};
          const updated = { ...moving, status: toStatus };
          const rest = state.contacts.filter((c) => c.id !== id);

          // Insert directly before a specific card (handles reorder + cross-column)
          if (beforeId) {
            const idx = rest.findIndex((c) => c.id === beforeId);
            if (idx !== -1) {
              return { contacts: [...rest.slice(0, idx), updated, ...rest.slice(idx)] };
            }
          }

          // No target card: append after the last card already in the destination column
          let lastIdx = -1;
          rest.forEach((c, i) => { if (c.status === toStatus) lastIdx = i; });
          return {
            contacts: lastIdx === -1
              ? [...rest, updated]
              : [...rest.slice(0, lastIdx + 1), updated, ...rest.slice(lastIdx + 1)],
          };
        }),
      deleteContact: (id) =>
        set((state) => ({
          contacts: state.contacts.filter((c) => c.id !== id),
          selectedContactId: state.selectedContactId === id ? null : state.selectedContactId,
        })),
      selectContact: (id) => set({ selectedContactId: id }),
    }),
    {
      name: 'orbit-crm',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // Only the contact data needs to survive reloads; the current selection
      // is transient UI state and should reset on each load.
      partialize: (state) => ({ contacts: state.contacts }),
      // Remap contacts saved under older status/warmth scales.
      migrate: (persisted) => {
        const state = persisted as { contacts?: Contact[] } | undefined;
        if (state?.contacts) {
          state.contacts = state.contacts.map((c) => ({
            ...c,
            status: normalizeStatus(c.status),
            warmth: normalizeWarmth(c.warmth),
          }));
        }
        return state as { contacts: Contact[] };
      },
    }
  )
);
