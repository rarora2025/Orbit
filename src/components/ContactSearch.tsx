'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import type { Contact } from '@/lib/mockData';
import { filterContacts } from '@/lib/contactSearch';
import CompanyLogo from './CompanyLogo';

/** Dashboard search: type to find anyone (by name, company, role, tags) across
 *  the whole network — active or archived — and jump straight to their detail. */
export default function ContactSearch({
  contacts,
  onSelect,
}: {
  contacts: Contact[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside the search.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const q = query.trim();
  const results = q ? filterContacts(contacts, q).slice(0, 8) : [];

  function choose(id: string) {
    onSelect(id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400/20 transition-colors">
        <Search size={14} className="flex-shrink-0 text-stone-400" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false); }
            if (e.key === 'Enter' && results[0]) choose(results[0].id);
          }}
          placeholder="Search people…"
          className="flex-1 min-w-0 bg-transparent text-[13px] text-stone-800 placeholder-stone-400 focus:outline-none"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); setOpen(false); }} className="flex-shrink-0 text-stone-300 hover:text-stone-500 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {open && q && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-300/40 overflow-hidden">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-stone-400">No one matches “{q}”.</p>
          ) : (
            results.map((c) => {
              const subtitle = [c.role, c.company].filter(Boolean).join(' · ');
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choose(c.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors"
                >
                  <CompanyLogo
                    company={c.company}
                    fallbackInitial={(c.company || c.name || '?').charAt(0).toUpperCase()}
                    fallbackColor={c.company ? 'bg-stone-100 text-stone-500' : c.avatarColor}
                    className="w-7 h-7 rounded-lg border border-stone-200 flex-shrink-0 p-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-stone-800 truncate">{c.name}</span>
                    {subtitle && <span className="block text-[11px] text-stone-400 truncate">{subtitle}</span>}
                  </span>
                  {c.archived && <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Archived</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
