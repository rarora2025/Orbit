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
import LinkedInIcon from '@/components/LinkedInIcon';
import { Check, X, Mail, Plus } from 'lucide-react';

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
  const { contacts, loaded, saveDraft, markSent } = useCRMStore();
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
  function dismiss(move: NextMove) {
    setDismissed((prev) => new Set(prev).add(move.id));
  }

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40 overflow-hidden">
        {/* Header — kept compact so the moves sit near the top */}
        <header className="flex-shrink-0 px-7 pt-5 pb-4 border-b border-stone-100">
          <h1 className="text-lg font-bold text-stone-900 tracking-tight">
            {greeting(now)}, {firstName}
          </h1>
        </header>

        {/* Goals — what you're pursuing, with the people tied to each */}
        <div className="flex-shrink-0 px-7 pt-5">
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-sm font-semibold text-stone-700">Goals</h2>
            {goalsLoaded && goals.length > 0 && (
              <span className="text-[12px] font-semibold text-stone-500 bg-stone-100 rounded-full px-2 py-0.5">{goals.length}</span>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
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

        {/* Upcoming — date-sorted meetings + follow-ups from the interactions table */}
        {loaded && upcoming.length > 0 && (
          <div className="flex-shrink-0 px-7 pt-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Upcoming</h2>
            <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
              {upcoming.map((item) => (
                <div key={`${item.contactId}-${item.kind}-${item.at}`} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-stone-200 bg-white">
                  <span className={`inline-flex items-center gap-1.5 flex-shrink-0 pl-2 pr-2.5 py-1 rounded-full text-[11px] font-semibold ${UPCOMING_TAG[item.tag].pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${UPCOMING_TAG[item.tag].dot}`} />
                    {item.tag}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-stone-800 truncate">{item.contactName}</p>
                    <p className={`text-[11px] ${item.overdue ? 'text-red-600 font-medium' : 'text-stone-400'}`}>{item.when}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => draftFor(item.contactId, item.kind === 'meeting' ? 'reply' : 'follow-up')}
                    className="flex-shrink-0 px-3 py-1.5 text-[12px] font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition active:scale-95"
                  >
                    {item.kind === 'meeting' ? 'Prep' : 'Draft'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your next moves */}
        <div className="flex-1 min-h-0 flex flex-col px-7 py-5">
          <div className="flex items-center gap-2.5 mb-4 flex-shrink-0">
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
            // Horizontal rail of tall cards — scroll sideways through the moves.
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden overscroll-contain -mx-1 px-1">
              <div className="flex gap-3.5 h-full pb-1">
                {moves.map((move) => {
                  const c = contacts.find((x) => x.id === move.contactId);
                  return (
                  <MoveCard
                    key={move.id}
                    move={move}
                    linkedinUrl={c?.linkedinUrl}
                    email={c?.email}
                    onDraft={() => { if (c) composer.open({ contact: c, kind: move.kind }); }}
                    onDone={() => markDone(move)}
                    onDismiss={() => dismiss(move)}
                  />
                  );
                })}
              </div>
            </div>
          )}
        </div>
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

function MoveCard({
  move, linkedinUrl, email, onDraft, onDone, onDismiss,
}: {
  move: NextMove;
  linkedinUrl?: string;
  email?: string;
  onDraft: () => void;
  onDone: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="w-[276px] flex-shrink-0 h-full max-h-[420px] flex flex-col rounded-2xl border border-stone-200 bg-stone-50/60 overflow-hidden">
      {/* Card head */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-[11px] font-semibold ${KIND_PILL[move.kind]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${KIND_DOT[move.kind]}`} />
            {KIND_LABEL[move.kind]}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="p-1 rounded-lg text-stone-300 hover:bg-stone-200/60 hover:text-stone-500 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        <p className="text-[15px] font-bold text-stone-900 leading-snug mt-3">{move.title}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[12px] text-stone-500">{move.detail}</span>
          {(linkedinUrl || email) && (
            <span className="flex items-center gap-0.5 ml-auto">
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn profile"
                  className="p-1 rounded-md text-stone-400 hover:bg-[#0A66C2]/10 hover:text-[#0A66C2] transition-colors"
                >
                  <LinkedInIcon size={13} />
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  aria-label="Email"
                  className="p-1 rounded-md text-stone-400 hover:bg-stone-200/60 hover:text-stone-600 transition-colors"
                >
                  <Mail size={13} />
                </a>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Draft preview — gives the card body and previews what Draft opens */}
      <div className="flex-1 min-h-0 mx-4 mb-3 rounded-xl bg-white border border-stone-200/80 p-3 overflow-hidden">
        <p className="text-[13px] text-stone-500 leading-relaxed line-clamp-6 whitespace-pre-wrap">{move.draft}</p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 space-y-2">
        <button
          type="button"
          onClick={onDraft}
          className="w-full px-3 py-2 bg-orange-500 text-white text-[13px] font-semibold rounded-lg hover:bg-orange-600 transition active:scale-[0.98] shadow-sm shadow-orange-500/30"
        >
          Draft message
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <SecondaryAction onClick={onDone} icon={<Check size={13} />} label="Done" />
          <SecondaryAction onClick={onDismiss} icon={<X size={13} />} label="Dismiss" />
        </div>
      </div>
    </div>
  );
}

function SecondaryAction({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 py-2 rounded-lg bg-white border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700 hover:bg-stone-50 transition active:scale-95"
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
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
