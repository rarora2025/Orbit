'use client';

import { useState } from 'react';
import { Contact, Status, Warmth } from '@/lib/mockData';
import { X, Sparkles, Loader2, Plus } from 'lucide-react';
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
const warmths: Warmth[] = ['Low', 'Medium', 'High'];
const warmthScore: Record<Warmth, number> = { Low: 45, Medium: 62, High: 85 };
const avatarPalette = [
  'bg-teal-200 text-teal-900', 'bg-orange-200 text-orange-900', 'bg-blue-200 text-blue-900',
  'bg-emerald-200 text-emerald-900', 'bg-purple-200 text-purple-900', 'bg-rose-200 text-rose-900',
  'bg-amber-200 text-amber-900', 'bg-cyan-200 text-cyan-900', 'bg-violet-200 text-violet-900',
];

// Candidate tags the "AI" draws from. In a real build this is a model call;
// here we derive a stable, plausible set from the person's name + company.
const TAG_POOL = [
  'Founder', 'Operator', 'Investor', 'VC', 'Angel', 'Engineering', 'Product',
  'Growth', 'Design', 'Prediction Markets', 'Sports Betting', 'Fantasy Sports',
  'Crypto', 'Fintech', 'Policy', 'Legal', 'AI/ML', 'Alumni', 'Warm Intro',
];

function suggestTags(seed: string, exclude: string[]): string[] {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = TAG_POOL.filter((t) => !exclude.includes(t));
  const out: string[] = [];
  let h = hash || 1;
  while (out.length < 3 && pool.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}

export default function ContactModal({ onClose, contact, onAdd, onSave }: Props) {
  const isEdit = !!contact;
  const [form, setForm] = useState({
    name: contact?.name ?? '',
    role: contact?.role ?? '',
    company: contact?.company ?? '',
    status: contact?.status ?? ('Send' as Status),
    warmth: contact?.warmth ?? ('Medium' as Warmth),
    tags: contact?.tags ?? ([] as string[]),
  });
  const [tagInput, setTagInput] = useState('');
  const [generating, setGenerating] = useState(false);

  function handleChange(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    setForm((f) => (f.tags.includes(t) ? f : { ...f, tags: [...f.tags, t] }));
    setTagInput('');
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  }

  function generateTags() {
    if (generating) return;
    setGenerating(true);
    const seed = `${form.name}|${form.company}`;
    // Brief delay so the action reads as an AI request, with a spinner.
    setTimeout(() => {
      setForm((f) => ({
        ...f,
        tags: Array.from(new Set([...f.tags, ...suggestTags(seed + f.tags.join(','), f.tags)])),
      }));
      setGenerating(false);
    }, 900);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (isEdit && contact) {
      onSave?.(contact.id, {
        name: form.name.trim(),
        role: form.role.trim(),
        company: form.company.trim(),
        status: form.status,
        warmth: form.warmth,
        score: warmthScore[form.warmth],
        tags: form.tags,
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
      linkedinUrl: '',
      email: '',
      inquiry: '',
      notes: '',
      status: form.status,
      priority: 'Medium',
      score: warmthScore[form.warmth],
      warmth: form.warmth,
      avatarColor: avatarPalette[Math.abs(nameHash) % avatarPalette.length],
      tags: form.tags,
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-stone-900 text-lg">{isEdit ? 'Edit Person' : 'Add Person'}</h2>
          </div>
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

          {/* Status */}
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={form.status} onChange={e => handleChange('status', e.target.value)}>
              {statuses.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Temperature — segmented control, consistent with the rest of the form */}
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

          {/* Tags — with AI generation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${labelClass} mb-0`}>Tags</label>
              <button
                type="button"
                onClick={generateTags}
                disabled={generating}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-60 transition-colors"
              >
                {generating
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Sparkles size={13} />}
                {generating ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-2 min-h-[42px] focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400/20 transition-colors">
              {form.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium pl-2.5 pr-1 py-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove ${tag}`}
                    className="rounded-full p-0.5 hover:bg-orange-200/70 text-orange-500 hover:text-orange-700 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
                  else if (e.key === 'Backspace' && !tagInput && form.tags.length) removeTag(form.tags[form.tags.length - 1]);
                }}
                placeholder={form.tags.length ? 'Add tag…' : 'Type a tag or generate with AI'}
                className="flex-1 min-w-[90px] bg-transparent text-sm text-stone-800 placeholder-stone-400 focus:outline-none px-1 py-0.5"
              />
              {tagInput.trim() && (
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  aria-label="Add tag"
                  className="rounded-md p-1 text-stone-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                >
                  <Plus size={14} />
                </button>
              )}
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
