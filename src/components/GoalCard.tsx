'use client';

import type { Goal } from '@/lib/goals';
import type { Contact } from '@/lib/mockData';

interface Props {
  goal: Goal;
  members: Contact[];
  /** True right after creation, before the first image resolves. */
  generating?: boolean;
  onClick: () => void;
}

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export default function GoalCard({ goal, members, generating, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-[220px] flex-shrink-0 text-left rounded-2xl border border-stone-200 bg-white overflow-hidden hover:border-stone-300 hover:shadow-md transition active:scale-[0.99]"
    >
      {/* Image banner / fallback */}
      <div className="relative h-28 w-full bg-gradient-to-br from-orange-100 via-amber-100 to-rose-100 flex items-center justify-center">
        {goal.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={goal.imageUrl} alt={goal.title} className="h-full w-full object-cover" />
        ) : generating ? (
          <span className="w-5 h-5 rounded-full border-2 border-orange-300 border-t-orange-500 animate-spin" />
        ) : (
          <span className="text-3xl font-bold text-orange-400/80">{initial(goal.title)}</span>
        )}
      </div>

      {/* Title + members */}
      <div className="px-3.5 py-3">
        <p className="text-[14px] font-bold text-stone-900 leading-snug line-clamp-2">{goal.title}</p>
        <div className="flex items-center gap-1.5 mt-2.5 min-h-[24px]">
          {members.length === 0 ? (
            <span className="text-[12px] text-stone-400">No people yet</span>
          ) : (
            <>
              <span className="flex -space-x-2">
                {members.slice(0, 4).map((m) => (
                  <span
                    key={m.id}
                    title={m.name}
                    className={`w-6 h-6 rounded-full ring-2 ring-white flex items-center justify-center text-[11px] font-semibold ${m.avatarColor || 'bg-stone-200 text-stone-700'}`}
                  >
                    {initial(m.name)}
                  </span>
                ))}
              </span>
              {members.length > 4 && (
                <span className="text-[12px] text-stone-400 font-medium">+{members.length - 4}</span>
              )}
            </>
          )}
        </div>
      </div>
    </button>
  );
}
