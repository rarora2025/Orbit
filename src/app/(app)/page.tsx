'use client';

import { useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCRMStore } from '@/lib/store';
import { buildNextMoves, NextMove, MoveKind } from '@/lib/nextMoves';
import DraftModal from '@/components/DraftModal';
import { useDraftComposer } from '@/components/useDraftComposer';
import LinkedInIcon from '@/components/LinkedInIcon';
import { Send, MessageCircle, Calendar, Clock, Check, X, Mail } from 'lucide-react';

const KIND_ICON: Record<MoveKind, typeof Send> = {
  'follow-up': Clock,
  'reply': MessageCircle,
  'outreach': Send,
};

const KIND_TINT: Record<MoveKind, string> = {
  'follow-up': 'bg-red-50 text-red-500',
  'reply': 'bg-emerald-50 text-emerald-600',
  'outreach': 'bg-blue-50 text-blue-600',
};

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function InsightsPage() {
  const { user } = useUser();
  const { contacts, loaded, updateContact, saveDraft, markSent } = useCRMStore();
  const composer = useDraftComposer();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const now = new Date();
  const allMoves = useMemo(() => buildNextMoves(contacts, new Date()), [contacts]);
  const moves = allMoves.filter((m) => !dismissed.has(m.id));

  const firstName = user?.firstName ?? user?.fullName?.split(' ')[0] ?? 'there';
  const today = () => new Date().toISOString().split('T')[0];

  function schedule(move: NextMove) {
    updateContact(move.contactId, { status: 'Meeting Scheduled' });
  }
  // Marking done moves them to Pending with today's date, so the move drops off.
  function markDone(move: NextMove) {
    updateContact(move.contactId, { status: 'Pending', lastContacted: today() });
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
                    onSchedule={() => schedule(move)}
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
    </>
  );
}

function MoveCard({
  move, linkedinUrl, email, onDraft, onSchedule, onDone, onDismiss,
}: {
  move: NextMove;
  linkedinUrl?: string;
  email?: string;
  onDraft: () => void;
  onSchedule: () => void;
  onDone: () => void;
  onDismiss: () => void;
}) {
  const Icon = KIND_ICON[move.kind];
  return (
    <div className="w-[276px] flex-shrink-0 h-full max-h-[420px] flex flex-col rounded-2xl border border-stone-200 bg-stone-50/60 overflow-hidden">
      {/* Card head */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${KIND_TINT[move.kind]}`}>
            <Icon size={16} />
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
          <span className="inline-flex items-center gap-1 text-[12px] text-stone-500">
            <Clock size={11} className="text-stone-400" />
            {move.detail}
          </span>
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
        <div className="grid grid-cols-3 gap-1.5">
          <SecondaryAction onClick={onSchedule} icon={<Calendar size={13} />} label="Schedule" />
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
