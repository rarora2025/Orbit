'use client';

import { useState, useMemo } from 'react';
import { useCRMStore } from '@/lib/store';
import { Status } from '@/lib/mockData';
import KanbanColumn from '@/components/KanbanColumn';
import ContactDetailPanel from '@/components/ContactDetailPanel';
import AddContactModal from '@/components/AddContactModal';
import { Search, Plus } from 'lucide-react';

const BOARD_STATUSES: Status[] = ['To Send', 'Pending', 'Responded', 'Meeting', 'Ghosted'];

export default function PipelinePage() {
  const { contacts, selectedContactId, selectContact, addContact } = useCRMStore();
  const [showAdd, setShowAdd] = useState(false);
  const [addStatus, setAddStatus] = useState<Status>('To Send');

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  const totalNeedAction = useMemo(
    () => contacts.filter(c => c.status === 'Pending' || c.status === 'Ghosted').length,
    [contacts]
  );

  const byStatus = useMemo(() => {
    const map: Record<Status, typeof contacts> = {
      'To Send': [], 'Pending': [], 'Responded': [], 'Meeting': [], 'Ghosted': [], 'Closed': [],
    };
    for (const c of contacts) map[c.status].push(c);
    return map;
  }, [contacts]);

  function handleAdd(status: Status) {
    setAddStatus(status);
    setShowAdd(true);
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* Board + header */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/60 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight leading-tight">Pipeline</h1>
            <p className="text-[12px] text-stone-400 mt-0.5">
              {contacts.length} relationships · {totalNeedAction} need action
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-stone-200 rounded-xl overflow-hidden text-[12px] font-medium shadow-sm">
              <button className="px-3 py-1.5 bg-stone-900 text-white">Board</button>
              <button className="px-3 py-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-colors">Table</button>
              <button className="px-3 py-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-colors">Map</button>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 shadow-sm transition-colors">
              <Search size={12} />
              Search
            </button>
            <button
              onClick={() => { setAddStatus('To Send'); setShowAdd(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 shadow-sm transition-colors"
            >
              <Plus size={13} />
              Add person
            </button>
          </div>
        </div>

        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 px-4 pt-4 h-full min-w-max">
            {BOARD_STATUSES.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                contacts={byStatus[status]}
                selectedId={selectedContactId}
                onSelect={(id) => selectContact(selectedContactId === id ? null : id)}
                onAdd={() => handleAdd(status)}
              />
            ))}
            <div className="w-4 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Contact detail panel */}
      {selectedContact && (
        <div className="w-[300px] flex-shrink-0 border-l border-stone-200/80 overflow-hidden">
          <ContactDetailPanel
            contact={selectedContact}
            onClose={() => selectContact(null)}
          />
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddContactModal
          onAdd={(c) => { addContact({ ...c, status: addStatus }); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
