'use client';

import { useState } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';

interface Props {
  /** Headline, e.g. "Draft for Nicholas Hull". */
  title: string;
  /** Message text — editable in place. Updated when the AI draft arrives. */
  draft: string;
  /** True while OpenAI is generating; the textarea shows the fallback meanwhile. */
  loading?: boolean;
  onClose: () => void;
}

/** Composer for any "Draft …" action. Opens with a heuristic fallback, then
 *  swaps in the AI-written message once it lands. Fully editable + copyable. */
export default function DraftModal({ title, draft, loading, onClose }: Props) {
  const [text, setText] = useState(draft);
  // When the AI draft replaces the fallback (draft prop changes), sync the
  // editor — React's endorsed "adjust state during render" pattern.
  const [prevDraft, setPrevDraft] = useState(draft);
  if (draft !== prevDraft) {
    setPrevDraft(draft);
    setText(draft);
  }

  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-stone-900 text-base truncate">{title}</h2>
            {loading && (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-orange-500 flex-shrink-0">
                <Loader2 size={13} className="animate-spin" />
                Writing…
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className={`w-full resize-none bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 leading-relaxed focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors ${loading ? 'opacity-60' : ''}`}
          />
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
            Close
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30 disabled:opacity-50"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
