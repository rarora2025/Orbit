'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreate: (title: string) => void;
}

export default function NewGoalModal({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
          <h2 className="font-bold text-stone-900 text-lg">New goal</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Goal</label>
            <input
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
              placeholder="e.g. Break into VC"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <p className="text-[12px] text-stone-400 mt-1.5">We&apos;ll generate a photo for it automatically.</p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30">
              Create goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
