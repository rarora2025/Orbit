'use client';

import { useMemo, useState } from 'react';
import { X, Trash2, RefreshCw, Plus } from 'lucide-react';
import { useGoalsStore } from '@/lib/goalsStore';
import { useCRMStore } from '@/lib/store';
import PersonAvatar from './PersonAvatar';

interface Props {
  goalId: string;
  onClose: () => void;
}

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export default function GoalDetailModal({ goalId, onClose }: Props) {
  const goal = useGoalsStore((s) => s.goals.find((g) => g.id === goalId));
  const { renameGoal, deleteGoal, addMember, removeMember, regenerateImage } = useGoalsStore();
  const contacts = useCRMStore((s) => s.contacts);

  const [title, setTitle] = useState(goal?.title ?? '');
  const [query, setQuery] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const members = useMemo(
    () => (goal ? contacts.filter((c) => goal.memberIds.includes(c.id)) : []),
    [contacts, goal],
  );
  const candidates = useMemo(() => {
    if (!goal) return [];
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => !goal.memberIds.includes(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q))
      .slice(0, 6);
  }, [contacts, goal, query]);

  if (!goal) return null;

  function commitTitle() {
    const t = title.trim();
    if (t && t !== goal!.title) renameGoal(goal!.id, t);
  }
  async function onRegenerate() {
    setRegenerating(true);
    try { await regenerateImage(goal!.id); } finally { setRegenerating(false); }
  }
  function onDelete() {
    deleteGoal(goal!.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        {/* Image header */}
        <div className="relative h-40 w-full bg-gradient-to-br from-orange-100 via-amber-100 to-rose-100 flex items-center justify-center flex-shrink-0">
          {goal.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={goal.imageUrl} alt={goal.title} className="h-full w-full object-cover" />
          ) : regenerating ? (
            <span className="w-6 h-6 rounded-full border-2 border-orange-300 border-t-orange-500 animate-spin" />
          ) : (
            <span className="text-4xl font-bold text-orange-400/80">{initial(goal.title)}</span>
          )}
          <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/80 hover:bg-white text-stone-500 hover:text-stone-700 transition-colors">
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/85 hover:bg-white text-stone-600 text-[12px] font-semibold transition-colors disabled:opacity-60"
          >
            <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
            Regenerate
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Goal</label>
            <input
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-semibold text-stone-800 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </div>

          {/* Members */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">People ({members.length})</label>
            {members.length === 0 ? (
              <p className="text-sm text-stone-400 italic">No people yet — add some below.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-stone-100 text-stone-700 text-[13px]">
                    <PersonAvatar contact={m} size={20} />
                    {m.name}
                    <button onClick={() => removeMember(goal.id, m.id)} aria-label={`Remove ${m.name}`} className="p-0.5 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-600">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Add people — existing contacts only */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Add people</label>
            <input
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
              placeholder="Search your people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {candidates.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { addMember(goal.id, c.id); setQuery(''); }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-50 text-left transition-colors"
                  >
                    <PersonAvatar contact={c} size={24} />
                    <span className="text-[13px] text-stone-700 flex-1 truncate">{c.name}{c.company ? <span className="text-stone-400"> · {c.company}</span> : null}</span>
                    <Plus size={14} className="text-stone-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={15} /> Delete
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-stone-700 hover:text-stone-900 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
