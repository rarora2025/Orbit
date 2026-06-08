'use client';

import { useState, useMemo } from 'react';
import { useCRMStore } from '@/lib/store';
import { Status } from '@/lib/mockData';
import KanbanColumn from '@/components/KanbanColumn';
import ContactModal from '@/components/ContactModal';
import { Plus } from 'lucide-react';

const BOARD_STATUSES: Status[] = ['Send', 'Pending', 'Response', 'Ghosted'];

export default function PipelinePage() {
  const { contacts, selectedContactId, selectContact, addContact, updateContact, moveContact, deleteContact } = useCRMStore();
  const [showAdd, setShowAdd] = useState(false);

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  const byStatus = useMemo(() => {
    const map: Record<Status, typeof contacts> = {
      'Send': [], 'Pending': [], 'Response': [], 'Ghosted': [],
    };
    for (const c of contacts) map[c.status]?.push(c);
    return map;
  }, [contacts]);

  function handleMoveContact(contactId: string, status: Status, beforeId: string | null) {
    moveContact(contactId, status, beforeId);
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Board sits on an elevated card so it lifts off the page background */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40">
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden overscroll-contain">
          <div className="flex h-full px-2 divide-x divide-stone-200/70">
            {BOARD_STATUSES.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                contacts={byStatus[status]}
                selectedId={selectedContactId}
                onSelect={(id) => selectContact(selectedContactId === id ? null : id)}
                onMoveContact={handleMoveContact}
                onDelete={deleteContact}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Single unified add button — replaces the old header + per-column adds */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-orange-500 rounded-full shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition active:scale-95"
      >
        <Plus size={18} />
        Add person
      </button>

      {/* Add modal */}
      {showAdd && (
        <ContactModal
          onAdd={(c) => { addContact(c); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Edit modal — clicking a card reopens the same form, pre-filled */}
      {!showAdd && selectedContact && (
        <ContactModal
          contact={selectedContact}
          onSave={(id, updates) => { updateContact(id, updates); selectContact(null); }}
          onClose={() => selectContact(null)}
        />
      )}
    </div>
  );
}
