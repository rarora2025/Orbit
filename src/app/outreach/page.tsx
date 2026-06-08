'use client';

import { useCRMStore } from '@/lib/store';
import { useState, useMemo } from 'react';
import StatusPill from '@/components/StatusPill';
import TagChip from '@/components/TagChip';
import { companyDisplayName } from '@/lib/companyLogo';
import { PenLine, Copy, Check, Sparkles, ChevronDown, RefreshCw } from 'lucide-react';

function generateMessage(contact: { name: string; company: string; role: string; inquiry: string; tags: string[]; status: string }): string {
  const firstName = contact.name.split(' ')[0];
  const company = companyDisplayName(contact.company);
  const tag = contact.tags[0] || 'your space';

  const templates = [
    `Hey ${firstName} — I've been building in the ${tag.toLowerCase()} space and your work at ${company} is directly relevant. I'm working on Orbit, which helps predict and surface market signals in sports/gaming, and I'd love 15 minutes to ask how you think about ${contact.inquiry || 'product and market design'}. Would you be open to a quick chat?`,
    `Hi ${firstName} — saw your work as ${contact.role} at ${company} and thought it was especially relevant to what I'm building. I'm a student founder working on Orbit (sports prediction intelligence) and had a few specific questions about ${contact.inquiry || tag.toLowerCase()}. Would you be open to a quick call this week?`,
    `Hey ${firstName} — I'm a student founder building Orbit in the sports prediction/gaming space. Your background at ${company} is exactly the kind of operator perspective I'm trying to learn from. Could I ask you one or two questions about ${contact.inquiry || 'how you think about the market'}? Even a quick async reply would be hugely valuable.`,
  ];

  if (contact.status === 'Ghosted') {
    return `Hey ${firstName} — I know I reached out a while back and totally understand if the timing wasn't right. I've made a lot of progress on Orbit since then and had one specific question about your work at ${company}: ${contact.inquiry || 'how you approached the early challenges'}. Even a short reply would mean a lot.`;
  }

  if (contact.status === 'Response') {
    return `Hey ${firstName} — wanted to follow up on our last conversation. I've been making real progress on Orbit and thought you'd be interested in where things are heading. Would love to loop back and hear your take, and ideally set up a quick call if you have 20 minutes.`;
  }

  return templates[Math.floor(Math.random() * templates.length)];
}

export default function OutreachPage() {
  const { contacts, selectContact } = useCRMStore();
  const [selectedId, setSelectedId] = useState<string>(contacts[0]?.id || '');
  const [copied, setCopied] = useState(false);
  const [regenerateCount, setRegenerateCount] = useState(0);

  const contact = useMemo(() => contacts.find(c => c.id === selectedId), [contacts, selectedId]);

  const message = useMemo(() => {
    if (!contact) return '';
    return generateMessage(contact);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, regenerateCount]);

  function copy() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sortedContacts = useMemo(() => {
    const order = { Dream: 0, High: 1, Medium: 2, Low: 3 };
    return [...contacts].sort((a, b) => order[a.priority] - order[b.priority]);
  }, [contacts]);

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Contact list sidebar */}
      <div className="w-64 border-r border-stone-200 overflow-y-auto flex-shrink-0 bg-stone-50/50">
        <div className="px-4 py-4 border-b border-stone-200">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Select Contact</p>
        </div>
        <div className="py-2">
          {sortedContacts.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full px-4 py-3 text-left transition-colors hover:bg-stone-100 ${
                selectedId === c.id ? 'bg-stone-900 hover:bg-stone-800' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  selectedId === c.id ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'
                }`}>
                  {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${selectedId === c.id ? 'text-white' : 'text-stone-800'}`}>
                    {c.name}
                  </p>
                  <p className={`text-[12px] truncate ${selectedId === c.id ? 'text-white/60' : 'text-stone-500'}`}>
                    {companyDisplayName(c.company)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Outreach editor */}
      <div className="flex-1 overflow-y-auto">
        {contact ? (
          <div className="px-8 py-8 max-w-2xl">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <PenLine size={18} className="text-orange-500" />
                <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Outreach Writer</h1>
              </div>
              <p className="text-stone-500 text-sm">AI-generated messages for each contact</p>
            </div>

            {/* Contact info */}
            <div className="bg-white border border-stone-200/80 rounded-2xl p-5 mb-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-base font-bold text-orange-700">
                  {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-stone-900">{contact.name}</h2>
                  <p className="text-sm text-stone-500">{contact.role} · {companyDisplayName(contact.company)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusPill status={contact.status} size="sm" />
                    {contact.tags.slice(0, 3).map(tag => <TagChip key={tag} tag={tag} />)}
                  </div>
                </div>
              </div>
              {contact.inquiry && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <p className="text-[12px] font-semibold text-stone-400 uppercase tracking-wider mb-1">Inquiry</p>
                  <p className="text-xs text-stone-600">{contact.inquiry}</p>
                </div>
              )}
            </div>

            {/* Outreach angle */}
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={13} className="text-violet-500" />
                <p className="text-xs font-semibold text-violet-700">Suggested Outreach Angle</p>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">{contact.outreachAngle}</p>
            </div>

            {/* Message */}
            <div className="bg-white border border-stone-200/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/50">
                <div className="flex items-center gap-2">
                  <PenLine size={13} className="text-stone-400" />
                  <p className="text-xs font-semibold text-stone-600">Generated Message</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRegenerateCount(c => c + 1)}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-stone-500 hover:text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    <RefreshCw size={10} />
                    Regenerate
                  </button>
                  <button
                    onClick={copy}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{message}</p>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">Outreach Tips for {contact.name}</p>
              <ul className="space-y-1.5">
                {[
                  'Keep it under 100 words — short messages get more replies',
                  'Mention something specific about their work to show you did your homework',
                  contact.status === 'Ghosted' ? 'Re-engagement: try a different angle, not just a follow-up nudge' : 'Ask one specific question — not "can we chat?"',
                  'Send on Tuesday or Wednesday morning for best response rates',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-stone-600">
                    <span className="text-amber-500 font-bold mt-0.5">·</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-stone-400 text-sm">Select a contact to generate outreach</p>
          </div>
        )}
      </div>
    </div>
  );
}
