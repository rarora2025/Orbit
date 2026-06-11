'use client';

import { useState } from 'react';
import { X, MessageSquare } from 'lucide-react';

const NEXT_STEPS = ['Reply back', 'Schedule meeting', 'Keep warm', 'Not interested'] as const;
type NextStep = (typeof NEXT_STEPS)[number];

interface Props {
  /** Name of the contact whose reply is being logged. */
  contactName: string;
  onSave: (input: { content: string; nextStep?: string }) => Promise<void>;
  onClose: () => void;
}

/** Captures a reply from a Pending contact, moving them to the Response column. */
export default function LogResponseModal({ contactName, onSave, onClose }: Props) {
  const [summary, setSummary] = useState('');
  const [nextStep, setNextStep] = useState<NextStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = summary.trim().length > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    let ok = false;
    try {
      await onSave({ content: summary, nextStep: nextStep ?? undefined });
      ok = true;
    } catch (e) {
      console.error('Log response failed', e);
      setError('Could not save response. Please try again.');
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
            <MessageSquare size={16} className="text-orange-500 flex-shrink-0" />
            Log response for {contactName}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="response-summary" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              Response summary
            </label>
            <textarea
              id="response-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              autoFocus
              placeholder="What did they say?"
              className="w-full resize-none bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 leading-relaxed placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
            />
          </div>

          <div>
            <span id="next-step-label" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              Next step <span className="font-normal normal-case tracking-normal text-stone-300">(optional)</span>
            </span>
            <div role="radiogroup" aria-labelledby="next-step-label" className="flex flex-wrap gap-1.5">
              {NEXT_STEPS.map((step) => {
                const active = nextStep === step;
                return (
                  <button
                    key={step}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    // Optional: clicking the selected step again clears it.
                    onClick={() => setNextStep(active ? null : step)}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
                      active
                        ? 'bg-orange-50 border-orange-200 text-orange-600'
                        : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
                    }`}
                  >
                    {step}
                  </button>
                );
              })}
            </div>
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
            Save Response
          </button>
        </div>
      </div>
    </div>
  );
}
