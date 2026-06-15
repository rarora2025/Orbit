'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Star } from 'lucide-react';

const PANEL_W = 256; // matches w-64
const MARGIN = 8;

/** Small "(i)" button that pops a short definition of what Temperature means.
 *  The panel renders in a portal with fixed positioning so it can never be
 *  clipped by the table's overflow, and is clamped to stay on screen.
 *  Click to toggle; closes on outside-click or Escape. */
export default function TemperatureInfo() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const left = Math.min(
      Math.max(MARGIN, b.left + b.width / 2 - PANEL_W / 2),
      window.innerWidth - PANEL_W - MARGIN
    );
    setPos({ top: b.bottom + MARGIN, left });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
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
        aria-label="What is Temperature?"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`flex items-center justify-center rounded-full transition-colors ${
          open ? 'text-orange-500' : 'text-stone-300 hover:text-stone-500'
        }`}
      >
        <Info size={13} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left, width: PANEL_W }}
          className="animate-modal-in fixed z-50 rounded-xl border border-stone-200 bg-white p-3.5 text-left shadow-xl shadow-stone-300/40 normal-case"
        >
          <div className="flex items-center gap-1.5 mb-2.5">
            {[1, 2, 3].map(i => (
              <Star key={i} size={12} className="fill-orange-400 text-orange-400" />
            ))}
            <span className="text-[13px] font-semibold text-stone-800 tracking-normal">Temperature</span>
          </div>
          <ul className="space-y-2 text-[12px] leading-relaxed text-stone-600 tracking-normal font-normal">
            <li className="flex gap-1.5">
              <span className="text-orange-400 font-bold">A.</span>
              <span><span className="font-semibold text-stone-700">Signal</span> — how high-value the person is.</span>
            </li>
            <li className="flex gap-1.5">
              <span className="text-orange-400 font-bold">B.</span>
              <span><span className="font-semibold text-stone-700">Likelihood</span> — how likely they are to deliver.</span>
            </li>
          </ul>
        </div>,
        document.body
      )}
    </>
  );
}
