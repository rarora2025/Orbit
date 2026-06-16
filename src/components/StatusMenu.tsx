'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Status, BOARD_STATUSES, columnConfig } from '@/lib/mockData';

const PANEL_W = 188;
const MARGIN = 8;
const FALLBACK = { dot: 'bg-stone-400', bg: 'bg-stone-100', text: 'text-stone-600' };

interface Props {
  status: Status;
  onChange: (status: Status) => void;
  size?: 'sm' | 'md';
}

/** The status pill as a dropdown: click to set any pipeline status. Renders the
 *  menu in a portal with fixed, viewport-clamped positioning so a table's
 *  overflow can't clip it. Closes on outside-click or Escape. */
export default function StatusMenu({ status, onChange, size = 'md' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cfg = columnConfig[status] ?? FALLBACK;

  const reposition = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const left = Math.min(Math.max(MARGIN, b.left), window.innerWidth - PANEL_W - MARGIN);
    setPos({ top: b.bottom + 4, left });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, reposition]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Status: ${status}. Click to change.`}
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-transparent font-medium transition hover:brightness-95 active:scale-95 ${cfg.bg} ${cfg.text} ${
          size === 'sm' ? 'text-[13px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {status}
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left, width: PANEL_W }}
          className="animate-modal-in fixed z-50 rounded-xl border border-stone-200 bg-white p-1 shadow-xl shadow-stone-300/40"
        >
          {BOARD_STATUSES.map((s) => {
            const c = columnConfig[s] ?? FALLBACK;
            const active = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); if (s !== status) onChange(s); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors ${
                  active ? 'bg-stone-100 text-stone-800' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                {s}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
