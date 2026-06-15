'use client';

import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface Props {
  /** Headline, e.g. "Message to Vinit Shah". */
  title: string;
  /** Optional channel chip (Email, LinkedIn, …). */
  channel?: string;
  /** The exact message text that was drafted/sent. */
  content: string;
  onClose: () => void;
}

/** Read-only view of a message from the timeline — same look as the Draft modal,
 *  minus the editing/sending controls. Just shows what was written, with Copy. */
export default function MessageViewModal({ title, channel, content, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-stone-900 text-base truncate">{title}</h2>
            {channel && (
              <span className="flex-shrink-0 text-[11px] font-semibold text-stone-500 bg-stone-100 rounded-full px-2 py-0.5">
                {channel}
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="w-full rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
            {content || <span className="text-stone-400 italic">No message text was recorded.</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
            Close
          </button>
          {content && (
            <button
              type="button"
              onClick={copy}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 hover:text-stone-800 transition active:scale-95"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
