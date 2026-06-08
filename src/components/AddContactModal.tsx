'use client';

import { useState } from 'react';
import { Contact, Status, Priority } from '@/lib/mockData';
import { X, Sparkles } from 'lucide-react';

interface Props {
  onAdd: (contact: Contact) => void;
  onClose: () => void;
}

const statuses: Status[] = ['To Send', 'Pending', 'Responded', 'Meeting', 'Ghosted', 'Closed'];
const priorities: Priority[] = ['Low', 'Medium', 'High', 'Dream'];

function generateAIHints(notes: string, linkedinText: string): { tags: string[]; angle: string } {
  const text = (notes + ' ' + linkedinText).toLowerCase();
  const tags: string[] = [];

  if (text.includes('prediction') || text.includes('polymarket') || text.includes('kalshi')) tags.push('Prediction Markets');
  if (text.includes('fantasy') || text.includes('draftkings') || text.includes('fanduel')) tags.push('Fantasy Sports');
  if (text.includes('vc') || text.includes('venture') || text.includes('fund') || text.includes('invest')) tags.push('VC / Funds');
  if (text.includes('founder') || text.includes('ceo') || text.includes('co-founder') || text.includes('startup')) tags.push('Startup Founders');
  if (text.includes('columbia') || text.includes('barnard')) tags.push('Columbia');
  if (text.includes('trading') || text.includes('quant') || text.includes('market maker')) tags.push('Trading');
  if (text.includes('sports') || text.includes('gaming') || text.includes('bettin')) tags.push('Sports Markets');
  if (text.includes('ai') || text.includes('machine learning') || text.includes('data science')) tags.push('AI / Data');
  if (text.includes('product') || text.includes('pm ') || text.includes('product manager')) tags.push('Product');
  if (text.includes('growth') || text.includes('marketing')) tags.push('Growth');

  const angle = tags.length > 0
    ? `Your work in ${tags.slice(0, 2).join(' and ')} aligns well with this contact. Lead with your perspective on ${tags[0].toLowerCase()} and ask a specific, informed question.`
    : `Research this person\'s most recent work before reaching out. Ask one specific question about their current focus.`;

  return { tags: tags.slice(0, 4), angle };
}

export default function AddContactModal({ onAdd, onClose }: Props) {
  const [form, setForm] = useState({
    name: '', company: '', role: '', linkedinUrl: '', email: '',
    inquiry: '', notes: '', status: 'To Send' as Status,
    priority: 'Medium' as Priority, tags: '', linkedinText: '',
  });
  const [aiHints, setAiHints] = useState<{ tags: string[]; angle: string } | null>(null);

  function handleChange(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function runAI() {
    const hints = generateAIHints(form.notes, form.linkedinText);
    setAiHints(hints);
    if (hints.tags.length > 0) {
      setForm(f => ({ ...f, tags: hints.tags.join(', ') }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hints = aiHints || generateAIHints(form.notes, form.linkedinText);
    const tagList = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : hints.tags;

    const avatarPalette = [
      'bg-teal-200 text-teal-900', 'bg-orange-200 text-orange-900', 'bg-blue-200 text-blue-900',
      'bg-emerald-200 text-emerald-900', 'bg-purple-200 text-purple-900', 'bg-rose-200 text-rose-900',
      'bg-amber-200 text-amber-900', 'bg-cyan-200 text-cyan-900', 'bg-violet-200 text-violet-900',
    ];
    const priorityScore: Record<Priority, number> = { Dream: 90, High: 78, Medium: 62, Low: 45 };
    const statusWarmth: Record<Status, 'Cool' | 'Warm' | 'Hot'> = {
      'To Send': 'Cool', 'Pending': 'Warm', 'Responded': 'Warm', 'Meeting': 'Hot', 'Ghosted': 'Cool', 'Closed': 'Cool',
    };
    let nameHash = 0;
    for (let i = 0; i < form.name.length; i++) nameHash = form.name.charCodeAt(i) + ((nameHash << 5) - nameHash);

    const contact: Contact = {
      id: Date.now().toString(),
      name: form.name,
      company: form.company,
      role: form.role,
      linkedinUrl: form.linkedinUrl,
      email: form.email,
      inquiry: form.inquiry,
      notes: form.notes,
      status: form.status,
      priority: form.priority,
      score: priorityScore[form.priority],
      warmth: statusWarmth[form.status],
      avatarColor: avatarPalette[Math.abs(nameHash) % avatarPalette.length],
      tags: tagList,
      lastContacted: new Date().toISOString().split('T')[0],
      nextAction: form.status === 'To Send' ? `Send first message to ${form.name}` : `Follow up with ${form.name}`,
      aiSummary: `${form.name} is ${form.role} at ${form.company}. ${form.inquiry || ''}`,
      outreachAngle: hints.angle,
      suggestedMessage: `Hey ${form.name.split(' ')[0]} — ${form.inquiry || `I'm building in the ${tagList[0] || 'space'} and would love to connect`}. Would you have 15 minutes to chat?`,
      interactions: [],
    };

    onAdd(contact);
  }

  const inputClass = "w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors";
  const labelClass = "block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
          <div>
            <h2 className="font-bold text-stone-900 text-lg">Add Contact</h2>
            <p className="text-xs text-stone-400 mt-0.5">Add someone to your network pipeline</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name + Company */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Name *</label>
              <input className={inputClass} placeholder="Shayne Coplan" required value={form.name} onChange={e => handleChange('name', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Company *</label>
              <input className={inputClass} placeholder="Polymarket" required value={form.company} onChange={e => handleChange('company', e.target.value)} />
            </div>
          </div>

          {/* Role + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Role / Title</label>
              <input className={inputClass} placeholder="CEO & Co-Founder" value={form.role} onChange={e => handleChange('role', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={e => handleChange('status', e.target.value)}>
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* LinkedIn + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>LinkedIn URL</label>
              <input className={inputClass} placeholder="https://linkedin.com/in/..." value={form.linkedinUrl} onChange={e => handleChange('linkedinUrl', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} placeholder="name@company.com" value={form.email} onChange={e => handleChange('email', e.target.value)} />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className={labelClass}>Priority / Temperature</label>
            <div className="grid grid-cols-4 gap-2">
              {priorities.map(p => (
                <button
                  key={p} type="button"
                  onClick={() => handleChange('priority', p)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                    form.priority === p
                      ? p === 'Dream' ? 'bg-violet-600 text-white border-violet-600' :
                        p === 'High' ? 'bg-rose-500 text-white border-rose-500' :
                        p === 'Medium' ? 'bg-amber-500 text-white border-amber-500' :
                        'bg-stone-400 text-white border-stone-400'
                      : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {p === 'Dream' ? '✦ Dream' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Inquiry */}
          <div>
            <label className={labelClass}>Inquiry / Context</label>
            <input className={inputClass} placeholder="What do you want to learn or ask them?" value={form.inquiry} onChange={e => handleChange('inquiry', e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea className={`${inputClass} resize-none`} rows={3} placeholder="Background, how you found them, what's interesting about them..." value={form.notes} onChange={e => handleChange('notes', e.target.value)} />
          </div>

          {/* Tags */}
          <div>
            <label className={labelClass}>Tags / Topics</label>
            <input className={inputClass} placeholder="Prediction Markets, Startup Founders, VC / Funds" value={form.tags} onChange={e => handleChange('tags', e.target.value)} />
          </div>

          {/* LinkedIn Paste + AI */}
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-violet-500" />
              <p className="text-xs font-semibold text-violet-700">AI Tag & Angle Generator</p>
            </div>
            <textarea
              className="w-full bg-white border border-violet-200 rounded-lg px-3 py-2 text-xs text-stone-700 placeholder-stone-400 focus:outline-none focus:border-violet-400 resize-none"
              rows={3}
              placeholder="Paste LinkedIn profile text or bio here..."
              value={form.linkedinText}
              onChange={e => handleChange('linkedinText', e.target.value)}
            />
            <button type="button" onClick={runAI} className="mt-2 flex items-center gap-1.5 bg-violet-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">
              <Sparkles size={12} />
              Generate Tags & Angle
            </button>
            {aiHints && (
              <div className="mt-3 space-y-2">
                {aiHints.tags.length > 0 && (
                  <div>
                    <p className="text-[10px] text-violet-600 font-semibold mb-1">Suggested tags applied:</p>
                    <div className="flex flex-wrap gap-1">
                      {aiHints.tags.map(t => (
                        <span key={t} className="text-[10px] bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 border border-violet-200">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-violet-600 font-semibold mb-1">Outreach angle:</p>
                  <p className="text-xs text-stone-600 leading-relaxed">{aiHints.angle}</p>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-stone-900 text-white text-sm font-semibold rounded-lg hover:bg-stone-800 transition-colors shadow-sm"
          >
            Add Contact
          </button>
        </div>
      </div>
    </div>
  );
}
