'use client';

import { useState } from 'react';
import { X, Copy, Check, Loader2, Send } from 'lucide-react';
import { TONES, CHANNELS, type Tone, type Channel } from '@/lib/draftMessage';

interface Props {
  /** Headline, e.g. "Draft outreach to Vinit Shah". */
  title: string;
  /** Message text — editable in place. Updated when tone/channel change or AI lands. */
  draft: string;
  tone: Tone;
  channel: Channel;
  /** True while OpenAI is generating; the deterministic draft shows meanwhile. */
  loading?: boolean;
  onToneChange: (tone: Tone) => void;
  onChannelChange: (channel: Channel) => void;
  onSaveDraft: (input: { channel: string; content: string }) => Promise<void>;
  onMarkSent: (input: { channel: string; content: string }) => Promise<void>;
  onClose: () => void;
}

export default function DraftModal({
  title, draft, tone, channel, loading,
  onToneChange, onChannelChange, onSaveDraft, onMarkSent, onClose,
}: Props) {
  const [text, setText] = useState(draft);
  // Sync the editor when the draft prop changes (tone/channel change or AI swap)
  // — React's endorsed "adjust state during render" pattern.
  const [prevDraft, setPrevDraft] = useState(draft);
  if (draft !== prevDraft) { setPrevDraft(draft); setText(draft); }

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function saveDraft() {
    setBusy(true);
    try {
      await onSaveDraft({ channel, content: text });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  async function markSent() {
    setBusy(true);
    try {
      await onMarkSent({ channel, content: text });
      onClose();
    } finally {
      setBusy(false);
    }
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

        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Segmented label="Channel" options={CHANNELS} value={channel} onChange={(v) => onChannelChange(v as Channel)} />
            <Segmented label="Tone" options={TONES} value={tone} onChange={(v) => onToneChange(v as Tone)} />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className={`w-full resize-none bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 leading-relaxed focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors ${loading ? 'opacity-60' : ''}`}
          />
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
            Cancel
          </button>
          {saved && <span className="text-[13px] font-medium text-emerald-600 inline-flex items-center gap-1"><Check size={14} /> Saved</span>}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 hover:text-stone-800 transition active:scale-95 disabled:opacity-50"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition active:scale-95 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={markSent}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30 disabled:opacity-50"
            >
              <Send size={15} />
              Mark Sent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Segmented({ label, options, value, onChange }: {
  label: string; options: readonly string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{label}</span>
      <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors ${
              value === opt ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
