'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCRMStore } from '@/lib/store';
import { BOARD_STATUSES, BOARD_COLUMNS } from '@/lib/mockData';
import { nextContactAt } from '@/lib/upcoming';
import KanbanColumn from '@/components/KanbanColumn';
import ContactCard from '@/components/ContactCard';
import ContactTable from '@/components/ContactTable';
import ViewToggle, { DashboardView } from '@/components/ViewToggle';
import ContactModal from '@/components/ContactModal';
import ContactDetailPanel from '@/components/ContactDetailPanel';
import DraftModal from '@/components/DraftModal';
import LogResponseModal from '@/components/LogResponseModal';
import ScheduleMeetingModal from '@/components/ScheduleMeetingModal';
import MarkMetModal from '@/components/MarkMetModal';
import SetFollowUpModal from '@/components/SetFollowUpModal';
import { useDraftComposer } from '@/components/useDraftComposer';
import { Plus, Archive } from 'lucide-react';

export default function PipelinePage() {
  const {
    contacts, loaded, selectedContactId, selectContact, addContact, updateContact, moveContact, deleteContact,
    archiveContact, unarchiveContact,
    saveDraft, markSent, logResponse, scheduleMeeting, markMet, moveToLongTerm, markGhosted, setFollowUp, clearFollowUp, setStatus,
  } = useCRMStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [metId, setMetId] = useState<string | null>(null);
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>('board');
  const [showArchived, setShowArchived] = useState(false);
  const composer = useDraftComposer();

  // Restore the last-used view after mount (kept out of initial render so the
  // server/client markup matches; the view-switch animation covers the swap).
  useEffect(() => {
    const saved = localStorage.getItem('dashboardView');
    // One-time read of a persisted UI preference on mount — deliberately not in
    // the initial render so server/client markup match and hydration stays clean.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'board' || saved === 'table') setView(saved);
  }, []);

  function changeView(next: DashboardView) {
    setView(next);
    localStorage.setItem('dashboardView', next);
  }

  const selectedContact = contacts.find(c => c.id === selectedContactId) ?? null;
  const editingContact = contacts.find(c => c.id === editingId) ?? null;
  const respondingContact = contacts.find(c => c.id === respondingId) ?? null;
  const meetingContact = contacts.find(c => c.id === meetingId) ?? null;
  const metContact = contacts.find(c => c.id === metId) ?? null;
  const followUpContact = contacts.find(c => c.id === followUpId) ?? null;

  // Archived people are hidden from the board + table, but kept everywhere else
  // (Insights, chat, search). They surface here only via "Show archived".
  const activeContacts = useMemo(() => contacts.filter(c => !c.archived), [contacts]);
  const archivedContacts = useMemo(() => contacts.filter(c => c.archived), [contacts]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(BOARD_STATUSES.map(s => [s, [] as typeof contacts])) as Record<string, typeof contacts>;
    for (const c of activeContacts) map[c.status]?.push(c);
    // Order each column by what's due soonest: contacts with a scheduled meeting
    // or follow-up first (earliest/overdue at top), the rest by board position.
    for (const s of BOARD_STATUSES) {
      map[s].sort((a, b) => {
        const da = nextContactAt(a);
        const db = nextContactAt(b);
        if (da && db) return da.localeCompare(db);
        if (da) return -1;
        if (db) return 1;
        return a.position - b.position;
      });
    }
    return map;
  }, [activeContacts]);

  // Table is ordered by what's due soonest: contacts with a scheduled meeting or
  // follow-up come first (earliest date — and overdue — at the top); those with
  // nothing scheduled fall to the bottom in board order (column, then position).
  const sortedContacts = useMemo(() => {
    const order = Object.fromEntries(BOARD_STATUSES.map((s, i) => [s, i]));
    return [...activeContacts].sort((a, b) => {
      const da = nextContactAt(a);
      const db = nextContactAt(b);
      if (da && db) return da.localeCompare(db);
      if (da) return -1;
      if (db) return 1;
      return (order[a.status] - order[b.status]) || (a.position - b.position);
    });
  }, [activeContacts]);

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
      {/* Main column — a slim header with the view switch sits above whichever
          view is showing (board or table). */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="flex-shrink-0 flex items-center justify-end gap-2 pb-3">
          {(archivedContacts.length > 0 || showArchived) && (
            <button
              type="button"
              onClick={() => setShowArchived(v => !v)}
              aria-pressed={showArchived}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border transition active:scale-95 ${
                showArchived
                  ? 'bg-stone-800 border-stone-800 text-white'
                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-800'
              }`}
            >
              <Archive size={14} />
              {showArchived ? 'Back to board' : `Archived${archivedContacts.length ? ` · ${archivedContacts.length}` : ''}`}
            </button>
          )}
          {!showArchived && <ViewToggle view={view} onChange={changeView} />}
        </div>

        {showArchived ? (
          <div key="archived" className="animate-view-in flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40 p-5">
            {archivedContacts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Archive size={26} className="text-stone-300 mb-2" />
                <p className="text-base font-semibold text-stone-700">No archived people</p>
                <p className="text-sm text-stone-400 mt-1">Archive someone from the board to tuck them away here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {archivedContacts.map(c => (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    onClick={() => selectContact(selectedContactId === c.id ? null : c.id)}
                    isSelected={selectedContactId === c.id}
                    onUnarchive={unarchiveContact}
                    onDelete={deleteContact}
                  />
                ))}
              </div>
            )}
          </div>
        ) : view === 'board' ? (
          /* Board — columns flex to fill the width; opening the panel just shrinks
             them. Horizontal scroll only kicks in once columns hit their min width. */
          <div key="board" className="animate-view-in flex-1 min-h-0 flex flex-col overflow-hidden rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40">
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
              <div className="flex min-h-full min-w-full divide-x divide-stone-200/70 items-stretch">
                {BOARD_COLUMNS.map(group => (
                  <div key={group.key} className="flex-1 min-w-[208px] flex flex-col px-3 divide-y divide-stone-200/60">
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
                        onArchive={archiveContact}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Table — same data, sorted to match the board's reading order */
          <div key="table" className="animate-view-in flex-1 min-h-0 overflow-y-auto overscroll-contain pb-6">
            <ContactTable
              contacts={sortedContacts}
              selectedId={selectedContactId}
              onSelect={(id) => selectContact(selectedContactId === id ? null : id)}
              onChangeStatus={(id, s) => setStatus(id, s)}
              onDelete={deleteContact}
            />
          </div>
        )}
      </div>

      {/* Detail side panel — slides in and pushes the board over */}
      <ContactDetailPanel
        contact={selectedContact}
        onClose={() => selectContact(null)}
        onEdit={(id) => setEditingId(id)}
        onDraft={(contact) => composer.open({ contact })}
        onLogResponse={(contact) => setRespondingId(contact.id)}
        onScheduleMeeting={(contact) => setMeetingId(contact.id)}
        onMarkMet={(contact) => setMetId(contact.id)}
        onMoveToLongTerm={(contact) => moveToLongTerm(contact.id)}
        onMarkGhosted={(contact) => markGhosted(contact.id)}
        onSetFollowUp={(contact) => setFollowUpId(contact.id)}
        onChangeStatus={(id, s) => setStatus(id, s)}
        onArchive={(contact, archived) => (archived ? archiveContact(contact.id) : unarchiveContact(contact.id))}
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

      {/* Log response modal — on save, advance to Response and immediately open
          the draft-reply composer to keep the momentum going. */}
      {respondingContact && (
        <LogResponseModal
          contactName={respondingContact.name}
          onSave={async (input) => {
            await logResponse(respondingContact.id, input);
            composer.open({ contact: respondingContact, kind: 'reply' });
          }}
          onClose={() => setRespondingId(null)}
        />
      )}

      {/* Schedule meeting modal */}
      {meetingContact && (
        <ScheduleMeetingModal
          contactName={meetingContact.name}
          onSave={(input) => scheduleMeeting(meetingContact.id, input)}
          onClose={() => setMeetingId(null)}
        />
      )}

      {/* Mark as met modal */}
      {metContact && (
        <MarkMetModal
          contactName={metContact.name}
          onSave={(input) => markMet(metContact.id, input)}
          onClose={() => setMetId(null)}
        />
      )}

      {/* Set follow-up / schedule-send date modal */}
      {followUpContact && (
        <SetFollowUpModal
          contactName={followUpContact.name}
          status={followUpContact.status}
          currentDate={followUpContact.nextFollowUpAt}
          onSave={(input) => setFollowUp(followUpContact.id, input)}
          onRemove={() => clearFollowUp(followUpContact.id)}
          onClose={() => setFollowUpId(null)}
        />
      )}

    </div>
  );
}
