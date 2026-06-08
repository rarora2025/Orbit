'use client';

import { useState } from 'react';
import { Contact } from '@/lib/mockData';
import StatusPill from './StatusPill';
import PriorityBadge from './PriorityBadge';
import CompanyLogo from './CompanyLogo';

interface Props {
  contact: Contact;
  onClick: () => void;
  isSelected?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const TEMP_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

export default function ContactCard({ contact, onClick, isSelected, draggable, onDragStart, onDragEnd }: Props) {
  const [dragging, setDragging] = useState(false);
  const temp = TEMP_LEVEL[contact.warmth] ?? 1;
  const initial = (contact.company || contact.name || '?').charAt(0).toUpperCase();
  const subtitle = [contact.role, contact.company].filter(Boolean).join(' · ');

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => { setDragging(true); onDragStart?.(e); }}
      onDragEnd={(e) => { setDragging(false); onDragEnd?.(e); }}
      className={`contact-card rounded-xl p-3 border bg-white transition-all duration-200 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${
        isSelected
          ? 'border-orange-400 ring-1 ring-orange-200 shadow-md'
          : 'border-stone-200/60 hover:border-stone-300 hover:shadow-md hover:-translate-y-0.5'
      } ${
        dragging ? 'opacity-40 scale-[0.98] shadow-lg rotate-[0.5deg]' : ''
      }`}
    >
      {/* Header: brand logo · name/role · fit score */}
      <div className="flex items-start gap-2.5">
        <CompanyLogo
          company={contact.company}
          fallbackInitial={initial}
          fallbackColor={contact.company ? 'bg-stone-100 text-stone-500' : contact.avatarColor}
          className="w-9 h-9 rounded-lg border border-stone-200 flex-shrink-0 p-1"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-stone-900 leading-tight truncate">
            {contact.name}
          </p>
          {subtitle && (
            <p className="text-[13px] text-stone-500 leading-tight truncate mt-0.5">{subtitle}</p>
          )}
        </div>
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full border-[1.5px] border-orange-400 flex items-center justify-center"
          title={`Fit score ${contact.score}`}
        >
          <span className="text-[13px] font-bold text-orange-500 leading-none">{contact.score}</span>
        </div>
      </div>

      {/* Footer: status · priority · temperature */}
      <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-stone-100">
        <StatusPill status={contact.status} size="sm" />
        <PriorityBadge priority={contact.priority} />
        <span
          title={`Temperature: ${contact.warmth}`}
          aria-label={`Temperature ${contact.warmth}`}
          className="ml-auto pl-1 font-bold text-[15px] leading-none tracking-[0.15em] select-none"
        >
          <span className="text-orange-500">{'*'.repeat(temp)}</span>
          <span className="text-stone-300">{'*'.repeat(3 - temp)}</span>
        </span>
      </div>
    </div>
  );
}
