'use client';

import { useState, useMemo } from 'react';
import { useCRMStore } from '@/lib/store';
import { Status } from '@/lib/mockData';
import { filterContacts } from '@/lib/contactSearch';
import KanbanColumn from '@/components/KanbanColumn';
import ContactTable from '@/components/ContactTable';
import ContactModal from '@/components/ContactModal';
import { Search, Plus, X } from 'lucide-react';

const BOARD_STATUSES: Status[] = ['Send', 'Pending', 'Response', 'Ghosted'];

type View = 'board' | 'table';

const VIEWS: { id: View; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'table', label: 'Table' },
];

export default function PipelinePage() {
  const { contacts, selectedContactId, selectContact, addContact, updateContact, moveContact } = useCRMStore();
  const [showAdd, setShowAdd] = useState(false);
  const [addStatus, setAddStatus] = useState<Status>('Send');
  const [view, setView] = useState<View>('board');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  const filteredContacts = useMemo(
    () => filterContacts(contacts, query),
    [contacts, query]
  );

  const byStatus = useMemo(() => {
    const map: Record<Status, typeof contacts> = {
      'Send': [], 'Pending': [], 'Response': [], 'Ghosted': [],
    };
    for (const c of filteredContacts) map[c.status]?.push(c);
    return map;
  }, [filteredContacts]);

  function closeSearch() {
    setSearchOpen(false);
    setQuery('');
  }

  function handleAdd(status: Status) {
    setAddStatus(status);
    setShowAdd(true);
  }

  function handleMoveContact(contactId: string, status: Status, beforeId: string | null) {
    moveContact(contactId, status, beforeId);
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* Board + header */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div className="relative flex items-center justify-end px-6 py-4 border-b border-stone-200/60 flex-shrink-0">
          <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold tracking-tight leading-tight bg-gradient-to-r from-blue-600 via-fuchsia-500 to-amber-400 bg-clip-text text-transparent">
            Your Network
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-stone-200 rounded-xl overflow-hidden text-[14px] font-medium shadow-sm">
              {VIEWS.map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`px-3 py-1.5 transition-colors ${
                    view === v.id
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {searchOpen ? (
              <div className="flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 bg-white border border-stone-200 rounded-xl shadow-sm focus-within:border-stone-300">
                <Search size={12} className="text-stone-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
                  placeholder="Search name, company, role, tag…"
                  className="w-56 py-1 text-[14px] text-stone-800 placeholder:text-stone-400 bg-transparent outline-none"
                />
                <button
                  onClick={closeSearch}
                  aria-label="Close search"
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 shadow-sm transition-colors"
              >
                <Search size={12} />
                Search
              </button>
            )}
            <button
              onClick={() => { setAddStatus('Send'); setShowAdd(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 shadow-sm transition active:scale-95"
            >
              <Plus size={13} />
              Add person
            </button>
          </div>
        </div>

        {/* Board view — one unified scroll area so every column moves together */}
        {view === 'board' && (
          <div className="flex-1 overflow-auto overscroll-contain">
            <div className="flex gap-3 px-4 pt-4 pb-10 w-max mx-auto items-start">
              {BOARD_STATUSES.map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  contacts={byStatus[status]}
                  selectedId={selectedContactId}
                  onSelect={(id) => selectContact(selectedContactId === id ? null : id)}
                  onAdd={() => handleAdd(status)}
                  onMoveContact={handleMoveContact}
                />
              ))}
              <div className="w-4 flex-shrink-0" />
            </div>
          </div>
        )}

        {/* Table view */}
        {view === 'table' && (
          <div className="flex-1 overflow-auto px-6 py-6">
            <ContactTable
              contacts={filteredContacts}
              selectedId={selectedContactId}
              onSelect={(id) => selectContact(selectedContactId === id ? null : id)}
            />
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <ContactModal
          onAdd={(c) => { addContact({ ...c, status: addStatus }); setShowAdd(false); }}
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
