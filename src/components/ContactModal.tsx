'use client';

import { useState } from 'react';
import { Contact, Warmth } from '@/lib/mockData';
import { X } from 'lucide-react';
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

const warmths: Warmth[] = ['Low', 'Medium', 'High'];
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
    role: contact?.role ?? '',
    company: contact?.company ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    linkedinUrl: contact?.linkedinUrl ?? '',
    warmth: contact?.warmth ?? ('Medium' as Warmth),
  });

  function handleChange(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (isEdit && contact) {
      // Status and tags are intentionally not edited here — status is set by
      // dragging on the board; tags are reserved for the future graph.
      onSave?.(contact.id, {
        name: form.name.trim(),
        role: form.role.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        linkedinUrl: form.linkedinUrl.trim(),
        warmth: form.warmth,
        score: warmthScore[form.warmth],
      });
      return;
    }

    let nameHash = 0;
    for (let i = 0; i < form.name.length; i++) nameHash = form.name.charCodeAt(i) + ((nameHash << 5) - nameHash);

    const newContact: Contact = {
      id: crypto.randomUUID(),
      position: 0, // placeholder; the store/server assigns the real column position
      name: form.name.trim(),
      company: form.company.trim(),
      role: form.role.trim(),
      linkedinUrl: form.linkedinUrl.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      notes: '',
      status: 'Send', // new people enter at the top of the pipeline; drag to move
      score: warmthScore[form.warmth],
      warmth: form.warmth,
      avatarColor: avatarPalette[Math.abs(nameHash) % avatarPalette.length],
      tags: [],
      lastContacted: new Date().toISOString().split('T')[0],
      // New people enter at "Send" with a send-by date of today, so they show up
      // in Next moves right away (reschedule via "Schedule send").
      nextFollowUpAt: new Date().toISOString(),
      nextAction: `Send first message to ${form.name.trim()}`,
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <h2 className="font-bold text-stone-900 text-lg">{isEdit ? 'Edit Person' : 'Add Person'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form id="contact-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5 overflow-y-auto">
          {/* Name */}
          <div>
            <label className={labelClass}>Name *</label>
            <input className={inputClass} placeholder="Shayne Coplan" required value={form.name} onChange={e => handleChange('name', e.target.value)} autoFocus />
          </div>

          {/* Title */}
          <div>
            <label className={labelClass}>Title</label>
            <input className={inputClass} placeholder="Founder & CEO" value={form.role} onChange={e => handleChange('role', e.target.value)} />
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

          {/* Temperature — segmented control */}
          <div>
            <label className={labelClass}>Temperature</label>
            <div className="grid grid-cols-3 gap-2">
              {warmths.map(w => {
                const active = form.warmth === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleChange('warmth', w)}
                    aria-pressed={active}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      active
                        ? 'bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/20'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact — points of contact, surfaced on cards and in next moves */}
          <div className="space-y-3 pt-1">
            <p className={labelClass}>Contact</p>
            <div>
              <input
                type="email"
                className={inputClass}
                placeholder="Email address"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
              />
            </div>
            <div>
              <input
                type="tel"
                className={inputClass}
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
              />
            </div>
            <div>
              <input
                type="url"
                className={inputClass}
                placeholder="LinkedIn URL"
                value={form.linkedinUrl}
                onChange={e => handleChange('linkedinUrl', e.target.value)}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            form="contact-form"
            className="px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30"
          >
            {isEdit ? 'Save Changes' : 'Add Person'}
          </button>
        </div>
      </div>
    </div>
  );
}
