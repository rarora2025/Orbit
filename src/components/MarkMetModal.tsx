'use client';

import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';

interface Props {
  /** Name of the contact whose meeting is being recapped. */
  contactName: string;
  onSave: (input: { notes: string; followUpAt?: string }) => Promise<void>;
  onClose: () => void;
}

/** Recaps a completed meeting, moving a Meeting Scheduled contact to Met. */
export default function MarkMetModal({ contactName, onSave, onClose }: Props) {
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = notes.trim().length > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    let ok = false;
    try {
      await onSave({ notes, followUpAt: followUpAt || undefined });
      ok = true;
    } catch (e) {
      console.error('Mark as met failed', e);
      setError('Could not save meeting notes. Please try again.');
    } finally {
      setBusy(false);
    }
    if (ok) onClose(); // close only after a successful save
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <h2 className="font-bold text-stone-900 text-base truncate flex items-center gap-2">
            <CheckCircle2 size={16} className="text-orange-500 flex-shrink-0" />
            How did the meeting with {contactName} go?
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="met-notes" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              Meeting notes
            </label>
            <textarea
              id="met-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              autoFocus
              placeholder="How did it go? What did you discuss?"
              className="w-full resize-none bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 leading-relaxed placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="met-followup" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              Next follow-up <span className="font-normal normal-case tracking-normal text-stone-300">(optional)</span>
            </label>
            <input
              id="met-followup"
              type="date"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
            Cancel
          </button>
          {error && <span className="text-[13px] font-medium text-red-600">{error}</span>}
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Meeting Notes
          </button>
        </div>
      </div>
    </div>
  );
}
