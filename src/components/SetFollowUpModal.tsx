'use client';

import { useState } from 'react';
import { X, Clock } from 'lucide-react';
import type { Status } from '@/lib/mockData';

interface Props {
  contactName: string;
  /** Drives the wording — a "Send" contact is being scheduled to send, not followed up. */
  status: Status;
  /** Existing follow-up date (ISO), if any — pre-fills the picker and enables Remove. */
  currentDate?: string;
  onSave: (input: { date: string; reason?: string }) => Promise<void>;
  /** Clears the existing follow-up date. */
  onRemove: () => Promise<void>;
  onClose: () => void;
}

/** Sets a contact's next-action date (the follow-up / send-by date). Available
 *  across statuses; defaults to today so a quick "remind me" is one click. An
 *  existing date can be removed outright. */
export default function SetFollowUpModal({ contactName, status, currentDate, onSave, onRemove, onClose }: Props) {
  const isSend = status === 'Send';
  const [date, setDate] = useState(() => (currentDate ? new Date(currentDate) : new Date()).toISOString().split('T')[0]);
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
      setError('Could not set the date. Please try again.');
    } finally {
      setBusy(false);
    }
    if (ok) onClose();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    let ok = false;
    try {
      await onRemove();
      ok = true;
    } catch (e) {
      console.error('Remove follow-up failed', e);
      setError('Could not remove the date. Please try again.');
    } finally {
      setBusy(false);
    }
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <h2 className="font-bold text-stone-900 text-base flex items-center gap-2">
            <Clock size={16} className="text-orange-500 flex-shrink-0" />
            {isSend ? `Schedule send to ${contactName}` : `Set follow-up for ${contactName}`}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="followup-date" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              {isSend ? 'Send by' : 'Follow up on'}
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
            <input
              id="followup-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isSend ? 'What to send' : "What to follow up on"}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
            Cancel
          </button>
          {currentDate && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="px-3 py-2 text-sm font-semibold text-red-600 rounded-lg hover:bg-red-50 transition active:scale-95 disabled:opacity-50"
            >
              Remove date
            </button>
          )}
          {error && <span className="text-[13px] font-medium text-red-600">{error}</span>}
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save date
          </button>
        </div>
      </div>
    </div>
  );
}
