'use client';

import { Contact } from '@/lib/mockData';
import { formatDate, getDaysSince } from '@/lib/utils';
import StatusPill from './StatusPill';
import PriorityBadge from './PriorityBadge';
import TagChip from './TagChip';
import {
  X, ExternalLink, Mail, Building2, Briefcase, Clock, Sparkles,
  MessageSquare, ArrowRight, Copy, Check, ChevronRight
} from 'lucide-react';
import { useState } from 'react';

interface Props {
  contact: Contact;
  onClose: () => void;
}

export default function ContactDetailPanel({ contact, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const days = getDaysSince(contact.lastContacted);

  function copyMessage() {
    navigator.clipboard.writeText(contact.suggestedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const typeIcons = { sent: '↗', received: '↙', note: '·', meeting: '◎' };
  const typeColors = {
    sent: 'text-blue-600',
    received: 'text-emerald-600',
    note: 'text-stone-500',
    meeting: 'text-violet-600',
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-stone-100">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-lg font-bold text-orange-700 flex-shrink-0">
            {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h2 className="font-bold text-stone-900 text-base leading-tight">{contact.name}</h2>
            <p className="text-stone-500 text-sm mt-0.5">{contact.role} · {contact.company}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Status + Priority row */}
        <div className="px-6 py-4 flex items-center gap-2 border-b border-stone-100">
          <StatusPill status={contact.status} />
          <PriorityBadge priority={contact.priority} />
          <div className="ml-auto flex items-center gap-1 text-xs text-stone-400">
            <Clock size={11} />
            <span>{days}d ago</span>
          </div>
        </div>

        {/* Quick info */}
        <div className="px-6 py-4 space-y-2.5 border-b border-stone-100">
          {contact.email && (
            <div className="flex items-center gap-2.5">
              <Mail size={13} className="text-stone-400 flex-shrink-0" />
              <a href={`mailto:${contact.email}`} className="text-xs text-stone-600 hover:text-orange-600 transition-colors">
                {contact.email}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Building2 size={13} className="text-stone-400 flex-shrink-0" />
            <span className="text-xs text-stone-600">{contact.company}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Briefcase size={13} className="text-stone-400 flex-shrink-0" />
            <span className="text-xs text-stone-600">{contact.role}</span>
          </div>
          {contact.linkedinUrl && (
            <div className="flex items-center gap-2.5">
              <ExternalLink size={13} className="text-stone-400 flex-shrink-0" />
              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700 transition-colors">
                LinkedIn Profile
              </a>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="px-6 py-4 border-b border-stone-100">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map(tag => <TagChip key={tag} tag={tag} />)}
          </div>
        </div>

        {/* Next Action */}
        <div className="px-6 py-4 border-b border-stone-100">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Next Action</p>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
            <ArrowRight size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">{contact.nextAction}</p>
          </div>
        </div>

        {/* AI Summary */}
        <div className="px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-violet-500" />
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">AI Summary</p>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">{contact.aiSummary}</p>
        </div>

        {/* Outreach Angle */}
        <div className="px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-violet-500" />
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Outreach Angle</p>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">{contact.outreachAngle}</p>
        </div>

        {/* Suggested Message */}
        <div className="px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare size={12} className="text-violet-500" />
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Suggested Message</p>
            </div>
            <button
              onClick={copyMessage}
              className="flex items-center gap-1 text-[10px] font-medium text-stone-500 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md px-2 py-1 transition-colors"
            >
              {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
            <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">{contact.suggestedMessage}</p>
          </div>
        </div>

        {/* Notes */}
        {contact.notes && (
          <div className="px-6 py-4 border-b border-stone-100">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Notes</p>
            <p className="text-xs text-stone-600 leading-relaxed">{contact.notes}</p>
          </div>
        )}

        {/* Inquiry */}
        {contact.inquiry && (
          <div className="px-6 py-4 border-b border-stone-100">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Inquiry / Context</p>
            <p className="text-xs text-stone-600 leading-relaxed">{contact.inquiry}</p>
          </div>
        )}

        {/* Interaction Timeline */}
        <div className="px-6 py-4">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-3">Interaction History</p>
          <div className="space-y-3">
            {contact.interactions.map((interaction, idx) => (
              <div key={interaction.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold ${
                    interaction.type === 'sent' ? 'bg-blue-100 text-blue-600' :
                    interaction.type === 'received' ? 'bg-emerald-100 text-emerald-600' :
                    interaction.type === 'meeting' ? 'bg-violet-100 text-violet-600' :
                    'bg-stone-100 text-stone-500'
                  }`}>
                    {typeIcons[interaction.type]}
                  </div>
                  {idx < contact.interactions.length - 1 && (
                    <div className="w-px h-3 bg-stone-200 mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-semibold capitalize ${typeColors[interaction.type]}`}>
                      {interaction.type}
                    </span>
                    <span className="text-[10px] text-stone-400">{formatDate(interaction.date)}</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{interaction.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
