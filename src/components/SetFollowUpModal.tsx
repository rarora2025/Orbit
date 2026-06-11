'use client';

import { useState } from 'react';
import { X, Clock } from 'lucide-react';

interface Props {
  /** Name of the contact the follow-up is being set for. */
  contactName: string;
  onSave: (input: { date: string; reason?: string }) => Promise<void>;
  onClose: () => void;
}

/** Sets a manual next-follow-up date and logs it, without changing status. */
export default function SetFollowUpModal({ contactName, onSave, onClose }: Props) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = date.length > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    let ok = false;
    try {
      await onSave({ date, reason: reason.trim() || undefined });
      ok = true;
    } catch (e) {
      console.error('Set follow-up failed', e);
      setError('Could not save follow-up. Please try again.');
    } finally {
      setBusy(false);
    }
    if (ok) onClose(); // close only after a successful save
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <h2 className="font-bold text-stone-900 text-base truncate flex items-center gap-2">
            <Clock size={16} className="text-orange-500 flex-shrink-0" />
            Set follow-up for {contactName}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="followup-date" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              Follow-up date
            </label>
            <input
              id="followup-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              autoFocus
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="followup-reason" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              Reason <span className="font-normal normal-case tracking-normal text-stone-300">(optional)</span>
            </label>
            <textarea
              id="followup-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why follow up?"
              className="w-full resize-none bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 leading-relaxed placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
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
            Save Follow-up
          </button>
        </div>
      </div>
    </div>
  );
}
