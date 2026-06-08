'use client';

import { useCRMStore } from '@/lib/store';
import { useMemo, useState } from 'react';
import StatusPill from '@/components/StatusPill';
import PriorityBadge from '@/components/PriorityBadge';
import { Zap, ArrowRight, Clock, CheckCircle, Search, UserPlus, Archive } from 'lucide-react';

function getDaysSince(dateStr: string): number {
  return Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 86400000);
}

export default function NextMovesPage() {
  const { contacts, selectContact } = useCRMStore();
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  function toggleComplete(id: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const moves = useMemo(() => {
    const urgent: Array<{ id: string; contact: typeof contacts[0]; reason: string; action: string; type: 'followup' | 'send' | 'archive' | 'deepen' }> = [];

    // Follow up with overdue pending
    contacts
      .filter(c => c.status === 'Pending' && getDaysSince(c.lastContacted) > 5)
      .sort((a, b) => {
        const pOrder = { Dream: 0, High: 1, Medium: 2, Low: 3 };
        return pOrder[a.priority] - pOrder[b.priority];
      })
      .forEach(c => {
        urgent.push({
          id: `followup-${c.id}`,
          contact: c,
          reason: `Pending since ${new Date(c.lastContacted).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${getDaysSince(c.lastContacted)} days ago`,
          action: `Follow up with ${c.name}`,
          type: 'followup',
        });
      });

    // Send first messages
    contacts
      .filter(c => c.status === 'Send')
      .forEach(c => {
        urgent.push({
          id: `send-${c.id}`,
          contact: c,
          reason: `First message not sent yet`,
          action: `Send first message to ${c.name}`,
          type: 'send',
        });
      });

    // Deepen responded
    contacts
      .filter(c => c.status === 'Response' && getDaysSince(c.lastContacted) > 14)
      .forEach(c => {
        urgent.push({
          id: `deepen-${c.id}`,
          contact: c,
          reason: `Responded ${getDaysSince(c.lastContacted)} days ago — relationship going cold`,
          action: `Deepen relationship with ${c.name}`,
          type: 'deepen',
        });
      });

    // Archive ghosted
    contacts
      .filter(c => c.status === 'Ghosted' && getDaysSince(c.lastContacted) > 30)
      .forEach(c => {
        urgent.push({
          id: `archive-${c.id}`,
          contact: c,
          reason: `Ghosted ${getDaysSince(c.lastContacted)} days ago`,
          action: `Re-engage or archive ${c.name}`,
          type: 'archive',
        });
      });

    return urgent;
  }, [contacts]);

  const pendingMoves = moves.filter(m => !completed.has(m.id));
  const completedMoves = moves.filter(m => completed.has(m.id));

  const typeConfig = {
    followup: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Follow Up' },
    send: { icon: ArrowRight, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Send Message' },
    deepen: { icon: UserPlus, color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-200', label: 'Deepen' },
    archive: { icon: Archive, color: 'text-stone-400', bg: 'bg-stone-50', border: 'border-stone-200', label: 'Review' },
  };

  const suggestedSearches = [
    'DraftKings fantasy product manager',
    'PrizePicks growth manager',
    'fantasy football newsletter founder',
    'prediction market developer advocate',
    'sports gaming startup operator',
    'FanDuel early employee',
    'Contrary capital fellow',
    'Pioneer.app winner sports',
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={18} className="text-amber-500" />
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Next Moves</h1>
          </div>
          <p className="text-stone-500 text-sm">Your personalized action queue for today</p>
        </div>

        {/* Progress */}
        <div className="bg-white border border-stone-200/80 rounded-2xl px-5 py-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-stone-700">Today's Progress</p>
            <p className="text-xs text-stone-500">{completed.size} / {moves.length} completed</p>
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${moves.length > 0 ? (completed.size / moves.length) * 100 : 0}%` }}
            />
          </div>
          {completed.size === moves.length && moves.length > 0 && (
            <p className="text-xs text-emerald-600 font-medium mt-2">🎉 All moves completed for today!</p>
          )}
        </div>

        {/* Action list */}
        {pendingMoves.length > 0 && (
          <div className="space-y-2.5 mb-8">
            <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Action Queue</h2>
            {pendingMoves.map(move => {
              const config = typeConfig[move.type];
              const Icon = config.icon;

              return (
                <div key={move.id} className={`bg-white border border-stone-200 hover:border-stone-300 rounded-2xl p-4 flex items-start gap-4 transition-all duration-150 shadow-sm hover:shadow group`}>
                  {/* Complete button */}
                  <button
                    onClick={() => toggleComplete(move.id)}
                    className="w-5 h-5 rounded-full border-2 border-stone-300 hover:border-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                  />

                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={15} className={config.color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-stone-800">{move.action}</p>
                      <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${config.bg} ${config.color} ${config.border}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <StatusPill status={move.contact.status} size="sm" />
                      <PriorityBadge priority={move.contact.priority} />
                    </div>
                    <p className="text-xs text-stone-500 flex items-center gap-1">
                      <Clock size={10} />
                      {move.reason}
                    </p>
                  </div>

                  {/* View button */}
                  <button
                    onClick={() => selectContact(move.contact.id)}
                    className="opacity-0 group-hover:opacity-100 text-[12px] font-medium text-stone-500 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0"
                  >
                    View →
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed */}
        {completedMoves.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Completed</h2>
            <div className="space-y-2">
              {completedMoves.map(move => (
                <div key={move.id} className="bg-stone-50 border border-stone-100 rounded-xl p-3.5 flex items-center gap-3 opacity-60">
                  <button onClick={() => toggleComplete(move.id)}>
                    <CheckCircle size={18} className="text-emerald-500" />
                  </button>
                  <p className="text-sm text-stone-500 line-through">{move.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested LinkedIn searches */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Search size={14} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-stone-700">Suggested LinkedIn Searches</h2>
          </div>
          <p className="text-xs text-stone-500 mb-3">Based on your weak clusters and strategic gaps:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedSearches.map(search => (
              <span
                key={search}
                className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 font-medium hover:bg-blue-100 cursor-pointer transition-colors"
              >
                <Search size={10} />
                {search}
              </span>
            ))}
          </div>
        </div>

        {/* Network gaps */}
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus size={14} className="text-violet-500" />
            <h2 className="text-sm font-semibold text-violet-800">Network Gap Analysis</h2>
          </div>
          <p className="text-xs text-violet-700 mb-3">You should add more contacts in these categories:</p>
          <div className="space-y-2">
            {[
              { role: 'Fantasy sports creators & newsletter founders', reason: 'Weak cluster with high strategic value for Orbit' },
              { role: 'Product managers at DraftKings / FanDuel', reason: 'Domain expertise you currently lack in your network' },
              { role: 'Startup operators (not just founders)', reason: 'Operators give tactical advice founders often skip' },
              { role: 'Fellow fellowship applicants (Z Fellows, Pioneer)', reason: 'Peer network often more valuable than senior contacts' },
            ].map(gap => (
              <div key={gap.role} className="flex items-start gap-2.5 bg-white/60 rounded-xl px-3.5 py-2.5">
                <ArrowRight size={12} className="text-violet-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-stone-800">{gap.role}</p>
                  <p className="text-[12px] text-stone-500 mt-0.5">{gap.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
