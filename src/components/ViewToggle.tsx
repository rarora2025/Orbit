'use client';

import { LayoutGrid, Rows3 } from 'lucide-react';

export type DashboardView = 'board' | 'table';

const OPTIONS: { value: DashboardView; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'board', label: 'Board', icon: LayoutGrid },
  { value: 'table', label: 'Table', icon: Rows3 },
];

interface Props {
  view: DashboardView;
  onChange: (view: DashboardView) => void;
}

/** Segmented Board/Table switch. A single pill slides under the active option,
 *  animating between the two rather than hard-cutting. */
export default function ViewToggle({ view, onChange }: Props) {
  const activeIndex = OPTIONS.findIndex(o => o.value === view);

  return (
    <div className="relative inline-flex items-center p-1 rounded-full bg-stone-100 border border-stone-200/70">
      {/* Sliding indicator — width is half the track; translate to the active half */}
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm shadow-stone-300/50 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = view === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
              active ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <Icon size={15} className={active ? 'text-orange-500' : ''} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
