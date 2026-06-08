'use client';

import { useState } from 'react';
import { Contact, Status, Warmth } from '@/lib/mockData';
import { X, Star } from 'lucide-react';
import CompanyLogo from './CompanyLogo';

interface Props {
  onClose: () => void;
  /** Present → edit mode (form is pre-filled and Save updates this contact). */
  contact?: Contact;
  /** Called in add mode with the freshly-built contact. */
  onAdd?: (contact: Contact) => void;
  /** Called in edit mode with the id and the changed fields. */
  onSave?: (id: string, updates: Partial<Contact>) => void;
}

const statuses: Status[] = ['Send', 'Pending', 'Response', 'Ghosted'];

// Temperature maps to the `warmth` DB field. 3 stars = Low / Medium / High.
const warmths: Warmth[] = ['Low', 'Medium', 'High'];
const warmthLevel: Record<Warmth, number> = { Low: 1, Medium: 2, High: 3 };
const warmthScore: Record<Warmth, number> = { Low: 45, Medium: 62, High: 85 };
const avatarPalette = [
  'bg-teal-200 text-teal-900', 'bg-orange-200 text-orange-900', 'bg-blue-200 text-blue-900',
  'bg-emerald-200 text-emerald-900', 'bg-purple-200 text-purple-900', 'bg-rose-200 text-rose-900',
  'bg-amber-200 text-amber-900', 'bg-cyan-200 text-cyan-900', 'bg-violet-200 text-violet-900',
];

export default function ContactModal({ onClose, contact, onAdd, onSave }: Props) {
  const isEdit = !!contact;
  const [form, setForm] = useState({
    name: contact?.name ?? '',
    company: contact?.company ?? '',
    status: contact?.status ?? ('Send' as Status),
    warmth: contact?.warmth ?? ('Medium' as Warmth),
  });

  function handleChange(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (isEdit && contact) {
      // Update only the editable fields; recompute the derived score/warmth so
      // the card stays consistent. Everything else on the contact is preserved.
      onSave?.(contact.id, {
        name: form.name.trim(),
        company: form.company.trim(),
        status: form.status,
        warmth: form.warmth,
        score: warmthScore[form.warmth],
      });
      return;
    }

    let nameHash = 0;
    for (let i = 0; i < form.name.length; i++) nameHash = form.name.charCodeAt(i) + ((nameHash << 5) - nameHash);

    // Only the essentials are collected here — everything else gets a sensible
    // default and can be enriched later.
    const newContact: Contact = {
      id: Date.now().toString(),
      name: form.name.trim(),
      company: form.company.trim(),
      role: '',
      linkedinUrl: '',
      email: '',
      inquiry: '',
      notes: '',
      status: form.status,
      priority: 'Medium',
      score: warmthScore[form.warmth],
      warmth: form.warmth,
      avatarColor: avatarPalette[Math.abs(nameHash) % avatarPalette.length],
      tags: [],
      lastContacted: new Date().toISOString().split('T')[0],
      nextAction: form.status === 'Send' ? `Send first message to ${form.name.trim()}` : `Follow up with ${form.name.trim()}`,
      aiSummary: '',
      outreachAngle: '',
      suggestedMessage: '',
      interactions: [],
    };

    onAdd?.(newContact);
  }

  const inputClass = "w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors";
  const labelClass = "block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
          <div>
            <h2 className="font-bold text-stone-900 text-lg">{isEdit ? 'Edit Person' : 'Add Person'}</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {isEdit ? 'Update the details and save' : 'Just the essentials — enrich the rest later'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className={labelClass}>Name *</label>
            <input className={inputClass} placeholder="Shayne Coplan" required value={form.name} onChange={e => handleChange('name', e.target.value)} autoFocus />
          </div>

          {/* Company (with live logo preview) */}
          <div>
            <label className={labelClass}>Company</label>
            <div className="flex items-center gap-2">
              <CompanyLogo
                company={form.company}
                fallbackInitial={(form.company || '?').charAt(0).toUpperCase()}
                fallbackColor="bg-stone-100 text-stone-400"
                className="w-9 h-9 rounded-lg border border-stone-200 flex-shrink-0 p-1"
              />
              <input className={inputClass} placeholder="Polymarket" value={form.company} onChange={e => handleChange('company', e.target.value)} />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={form.status} onChange={e => handleChange('status', e.target.value)}>
              {statuses.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Temperature — star rating mapped to the warmth field */}
          <div>
            <label className={labelClass}>Temperature</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {warmths.map(w => {
                  const filled = warmthLevel[form.warmth] >= warmthLevel[w];
                  return (
                    <button
                      key={w} type="button"
                      onClick={() => handleChange('warmth', w)}
                      aria-label={`${w} temperature`}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Star
                        size={28}
                        className={filled ? 'fill-orange-400 text-orange-400' : 'fill-stone-100 text-stone-300'}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-sm font-medium text-stone-500">{form.warmth}</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-stone-900 text-white text-sm font-semibold rounded-lg hover:bg-stone-800 transition active:scale-95 shadow-sm"
          >
            {isEdit ? 'Save Changes' : 'Add Person'}
          </button>
        </div>
      </div>
    </div>
  );
}
