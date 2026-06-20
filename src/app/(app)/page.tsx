'use client';

import { useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCRMStore } from '@/lib/store';
import { useGoalsStore } from '@/lib/goalsStore';
import { buildNextMoves, dueSoonCutoff, NextMove, MoveKind } from '@/lib/nextMoves';
import { buildUpcoming } from '@/lib/upcoming';
import DraftModal from '@/components/DraftModal';
import GoalCard from '@/components/GoalCard';
import NewGoalModal from '@/components/NewGoalModal';
import GoalDetailModal from '@/components/GoalDetailModal';
import { useDraftComposer } from '@/components/useDraftComposer';
import { Check, X, Plus } from 'lucide-react';

// Each move maps to a status; label + dot mirror the board's pill language
// instead of a glyph tile, so the two views read the same.
const KIND_LABEL: Record<MoveKind, string> = {
  'follow-up': 'Follow-up',
  'reply': 'Reply',
  'outreach': 'Outreach',
};

const KIND_DOT: Record<MoveKind, string> = {
  'follow-up': 'bg-amber-400',
  'reply': 'bg-emerald-500',
  'outreach': 'bg-blue-500',
};

const KIND_PILL: Record<MoveKind, string> = {
  'follow-up': 'bg-amber-50 text-amber-700',
  'reply': 'bg-emerald-50 text-emerald-700',
  'outreach': 'bg-blue-50 text-blue-700',
};

// Tag styles for the Upcoming list — same pill language as the move cards.
const UPCOMING_TAG: Record<string, { dot: string; pill: string }> = {
  'Meeting': { dot: 'bg-indigo-500', pill: 'bg-indigo-50 text-indigo-700' },
  'Follow-up': { dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700' },
  'Send': { dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700' },
};

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function InsightsPage() {
  const { user } = useUser();
  const { contacts, loaded, saveDraft, markSent, clearFollowUp } = useCRMStore();
  const { goals, loaded: goalsLoaded, generatingImageIds, addGoal } = useGoalsStore();
  const composer = useDraftComposer();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);

  const now = new Date();
  const allMoves = useMemo(() => buildNextMoves(contacts, new Date()), [contacts]);
  const moves = allMoves.filter((m) => !dismissed.has(m.id));
  // Upcoming is the forward agenda: all meetings, plus follow-ups that are
  // further out than the "next moves" window (so imminent ones aren't shown twice).
  const upcoming = useMemo(() => {
    const cutoff = dueSoonCutoff(new Date());
    return buildUpcoming(contacts, new Date()).filter(
      (item) => item.kind === 'meeting' || new Date(item.at).getTime() > cutoff
    );
  }, [contacts]);

  function draftFor(contactId: string, kind: MoveKind) {
    const c = contacts.find((x) => x.id === contactId);
    if (c) composer.open({ contact: c, kind });
  }

  const firstName = user?.firstName ?? user?.fullName?.split(' ')[0] ?? 'there';

  // "Done" = "I sent this." Log it as a sent message so the timeline reads
  // "Marked message as sent" (not a silent status flip) and the thread advances
  // to Pending with a fresh follow-up — the move then drops off the list.
  function markDone(move: NextMove) {
    markSent(move.contactId, { channel: 'manual', content: '' });
  }
  // Dismiss = "stop nagging me about this." Clear the contact's next-action date
  // so the move drops off for good (it's driven by nextFollowUpAt) and doesn't
  // reappear on reload. Keep the local set for instant removal before the write
  // round-trips.
  function dismiss(move: NextMove) {
    setDismissed((prev) => new Set(prev).add(move.id));
    clearFollowUp(move.contactId);
  }

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40 overflow-y-auto">
        {/* Header — kept compact so the moves sit near the top */}
        <header className="flex-shrink-0 px-4 sm:px-7 pt-5 pb-4 border-b border-stone-100">
          <h1 className="text-lg font-bold text-stone-900 tracking-tight">
            {greeting(now)}, {firstName}
          </h1>
        </header>

        {/* Goals — what you're pursuing, with the people tied to each */}
        <div className="flex-shrink-0 px-4 sm:px-7 pt-5">
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-sm font-semibold text-stone-700">Goals</h2>
            <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-1.5 py-0.5 leading-none">Beta</span>
            {goalsLoaded && goals.length > 0 && (
              <span className="text-[12px] font-semibold text-stone-500 bg-stone-100 rounded-full px-2 py-0.5">{goals.length}</span>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto scroll-affordance pb-2 -mx-1 px-1">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                members={contacts.filter((c) => goal.memberIds.includes(c.id))}
                generating={generatingImageIds.includes(goal.id)}
                onClick={() => setOpenGoalId(goal.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => setCreatingGoal(true)}
              className="w-[220px] flex-shrink-0 h-[180px] rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 hover:border-orange-300 hover:text-orange-500 transition flex flex-col items-center justify-center gap-2"
            >
              <Plus size={22} />
              <span className="text-[13px] font-semibold">New goal</span>
            </button>
          </div>
        </div>

        {/* Your next moves — a compact list so the Draft / Done / Dismiss
            actions are always visible inline (the tall cards used to cut them
            off). The page scrolls when the list is long. */}
        <div className="flex-shrink-0 px-4 sm:px-7 pt-5">
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-sm font-semibold text-stone-700">Your next moves</h2>
            {loaded && moves.length > 0 && (
              <span className="text-[12px] font-semibold text-stone-500 bg-stone-100 rounded-full px-2 py-0.5">
                {moves.length}
              </span>
            )}
          </div>

          {!loaded ? (
            <div className="flex items-center gap-2 text-stone-400 text-sm py-10 justify-center">
              <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-orange-400 animate-spin" />
              Loading…
            </div>
          ) : moves.length === 0 ? (
            <EmptyState caughtUp={allMoves.length > 0} />
          ) : (
            <div className="flex flex-col gap-2">
              {moves.map((move) => {
                const c = contacts.find((x) => x.id === move.contactId);
                return (
                  <MoveRow
                    key={move.id}
                    move={move}
                    onDraft={() => { if (c) composer.open({ contact: c, kind: move.kind }); }}
                    onDone={() => markDone(move)}
                    onDismiss={() => dismiss(move)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming — date-sorted meetings + follow-ups, as a scrollable card rail */}
        {loaded && upcoming.length > 0 && (
          <div className="flex-shrink-0 px-4 sm:px-7 pt-6 pb-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Upcoming</h2>
            <div className="flex gap-3 overflow-x-auto scroll-affordance pb-2 -mx-1 px-1">
              {upcoming.map((item) => (
                <div
                  key={`${item.contactId}-${item.kind}-${item.at}`}
                  className="w-[200px] flex-shrink-0 rounded-2xl border border-stone-200 bg-white p-3.5 flex flex-col gap-2.5"
                >
                  <span className={`self-start inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-[11px] font-semibold ${UPCOMING_TAG[item.tag].pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${UPCOMING_TAG[item.tag].dot}`} />
                    {item.tag}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-stone-800 truncate">{item.contactName}</p>
                    <p className={`text-[12px] mt-0.5 ${item.overdue ? 'text-red-600 font-medium' : 'text-stone-400'}`}>{item.when}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => draftFor(item.contactId, item.kind === 'meeting' ? 'reply' : 'follow-up')}
                    className="mt-auto w-full px-3 py-1.5 text-[12px] font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition active:scale-95"
                  >
                    {item.kind === 'meeting' ? 'Prep' : 'Draft'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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

      {creatingGoal && (
        <NewGoalModal onClose={() => setCreatingGoal(false)} onCreate={(title) => addGoal(title)} />
      )}
      {openGoalId && (
        <GoalDetailModal goalId={openGoalId} onClose={() => setOpenGoalId(null)} />
      )}
    </>
  );
}

function MoveRow({
  move, onDraft, onDone, onDismiss,
}: {
  move: NextMove;
  onDraft: () => void;
  onDone: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-stone-200 bg-white">
      <span className={`inline-flex items-center gap-1.5 flex-shrink-0 pl-2 pr-2.5 py-1 rounded-full text-[11px] font-semibold ${KIND_PILL[move.kind]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${KIND_DOT[move.kind]}`} />
        {KIND_LABEL[move.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-stone-800 truncate">{move.title}</p>
        {move.detail && <p className="text-[11px] text-stone-400 truncate">{move.detail}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onDraft}
          className="px-3 py-1.5 text-[12px] font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30"
        >
          Draft
        </button>
        <button
          type="button"
          onClick={onDone}
          aria-label="Done"
          title="Done — I handled this"
          className="p-1.5 rounded-lg text-stone-400 hover:bg-emerald-50 hover:text-emerald-600 transition active:scale-95"
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
          className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition active:scale-95"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ caughtUp }: { caughtUp: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <p className="text-base font-semibold text-stone-800">
        {caughtUp ? "That's everything for now" : "Nothing here yet"}
      </p>
      <p className="text-sm text-stone-400 mt-1 max-w-xs">
        {caughtUp
          ? 'You’ve cleared your moves. New ones appear as your relationships change.'
          : 'Add people on the Dashboard or chat about your network, and your next moves will show up here.'}
      </p>
    </div>
  );
}
