'use client';

import { useState, useMemo } from 'react';
import { useCRMStore } from '@/lib/store';
import { BOARD_STATUSES, BOARD_COLUMNS } from '@/lib/mockData';
import KanbanColumn from '@/components/KanbanColumn';
import ContactModal from '@/components/ContactModal';
import ContactDetailPanel from '@/components/ContactDetailPanel';
import DraftModal from '@/components/DraftModal';
import LogResponseModal from '@/components/LogResponseModal';
import { useDraftComposer } from '@/components/useDraftComposer';
import { Plus } from 'lucide-react';

export default function PipelinePage() {
  const { contacts, loaded, selectedContactId, selectContact, addContact, updateContact, moveContact, deleteContact, saveDraft, markSent, logResponse } = useCRMStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const composer = useDraftComposer();

  const selectedContact = contacts.find(c => c.id === selectedContactId) ?? null;
  const editingContact = contacts.find(c => c.id === editingId) ?? null;
  const respondingContact = contacts.find(c => c.id === respondingId) ?? null;

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(BOARD_STATUSES.map(s => [s, [] as typeof contacts])) as Record<string, typeof contacts>;
    for (const c of contacts) map[c.status]?.push(c);
    return map;
  }, [contacts]);

  // Hold the board until the first server hydration lands, so a returning user
  // doesn't see a flash of empty columns before their contacts load.
  if (!loaded) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="flex items-center gap-2 text-stone-400 text-sm">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-orange-400 animate-spin" />
          Loading your pipeline…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Board — columns flex to fill the width; opening the panel just shrinks
          them. Horizontal scroll only kicks in once columns hit their min width. */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40">
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden overscroll-contain">
          <div className="flex h-full min-w-full divide-x divide-stone-200/70">
            {BOARD_COLUMNS.map(group => (
              <div key={group.key} className="flex-1 min-w-[208px] flex flex-col min-h-0 px-3 divide-y divide-stone-200/60">
                {group.statuses.map(status => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    contacts={byStatus[status]}
                    selectedId={selectedContactId}
                    onSelect={(id) => selectContact(selectedContactId === id ? null : id)}
                    onEdit={(id) => setEditingId(id)}
                    onMoveContact={(contactId, s, beforeId) => moveContact(contactId, s, beforeId)}
                    onDelete={deleteContact}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail side panel — slides in and pushes the board over */}
      <ContactDetailPanel
        contact={selectedContact}
        onClose={() => selectContact(null)}
        onEdit={(id) => setEditingId(id)}
        onDraft={(contact) => composer.open({ contact })}
        onLogResponse={(contact) => setRespondingId(contact.id)}
      />

      {/* Single unified add button */}
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

      {/* Edit modal — opened from the card's pencil button or the detail panel */}
      {editingContact && (
        <ContactModal
          contact={editingContact}
          onSave={(id, updates) => { updateContact(id, updates); setEditingId(null); }}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Draft composer */}
      {composer.state && (
        <DraftModal
          title={composer.state.title}
          draft={composer.state.draft}
          tone={composer.state.tone}
          channel={composer.state.channel}
          loading={composer.state.loading}
          onToneChange={composer.setTone}
          onChannelChange={composer.setChannel}
          onSaveDraft={(input) => saveDraft(composer.state!.contact.id, input)}
          onMarkSent={(input) => markSent(composer.state!.contact.id, input)}
          onClose={composer.close}
        />
      )}

      {/* Log response modal */}
      {respondingContact && (
        <LogResponseModal
          contactName={respondingContact.name}
          onSave={(input) => logResponse(respondingContact.id, input)}
          onClose={() => setRespondingId(null)}
        />
      )}
    </div>
  );
}
