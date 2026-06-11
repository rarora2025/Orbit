'use client';

import { useState } from 'react';
import { Contact } from '@/lib/mockData';
import { contactDateBadge } from '@/lib/upcoming';
import CompanyLogo from './CompanyLogo';
import { Trash2, Star, Pencil, Mail, Calendar, Clock } from 'lucide-react';
import LinkedInIcon from './LinkedInIcon';

interface Props {
  contact: Contact;
  onClick: () => void;
  isSelected?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const TEMP_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

export default function ContactCard({ contact, onClick, isSelected, onEdit, onDelete, draggable, onDragStart, onDragEnd }: Props) {
  const [dragging, setDragging] = useState(false);
  const temp = TEMP_LEVEL[contact.warmth] ?? 1;
  const initial = (contact.company || contact.name || '?').charAt(0).toUpperCase();
  const subtitle = [contact.role, contact.company].filter(Boolean).join(' · ');
  const badge = contactDateBadge(contact);
  const badgeTone = !badge
    ? ''
    : badge.kind === 'meeting'
      ? 'bg-indigo-50 text-indigo-700'
      : badge.overdue
        ? 'bg-red-50 text-red-600'
        : 'bg-amber-50 text-amber-700';

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => { setDragging(true); onDragStart?.(e); }}
      onDragEnd={(e) => { setDragging(false); onDragEnd?.(e); }}
      className={`contact-card group relative rounded-xl p-3 border bg-white transition-all duration-200 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${
        isSelected
          ? 'border-orange-400 ring-1 ring-orange-200 shadow-md'
          : 'border-stone-200/60 hover:border-stone-300 hover:shadow-md hover:-translate-y-0.5'
      } ${
        dragging ? 'opacity-40 scale-[0.98] shadow-lg rotate-[0.5deg]' : ''
      }`}
    >
      {/* Header: brand logo · name/role · temperature */}
      <div className="flex items-start gap-2.5">
        <CompanyLogo
          company={contact.company}
          fallbackInitial={initial}
          fallbackColor={contact.company ? 'bg-stone-100 text-stone-500' : contact.avatarColor}
          className="w-11 h-11 rounded-lg border border-stone-200 flex-shrink-0 p-1"
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
          className="flex-shrink-0 flex items-center gap-0.5"
          title={`Temperature: ${contact.warmth}`}
          aria-label={`Temperature ${contact.warmth}`}
        >
          {[1, 2, 3].map((i) => (
            <Star
              key={i}
              size={13}
              className={i <= temp ? 'fill-orange-400 text-orange-400' : 'fill-stone-100 text-stone-200'}
            />
          ))}
        </div>
      </div>

      {/* Date badge: next meeting, else next follow-up (red when overdue) */}
      {badge && (
        <span className={`mt-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ${badgeTone}`}>
          {badge.kind === 'meeting' ? <Calendar size={11} /> : <Clock size={11} />}
          {badge.label}
        </span>
      )}

      {/* Footer: quick links to reach them + edit/delete */}
      <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 flex-1 min-w-0">
          {contact.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`${contact.name} on LinkedIn`}
              className="p-1 rounded-md text-stone-400 hover:bg-[#0A66C2]/10 hover:text-[#0A66C2] transition-colors"
            >
              <LinkedInIcon size={14} />
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Email ${contact.name}`}
              className="p-1 rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
            >
              <Mail size={14} />
            </a>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            aria-label={`Edit ${contact.name}`}
            onClick={(e) => { e.stopPropagation(); onEdit(contact.id); }}
            className="flex-shrink-0 p-1 rounded-lg text-stone-300 opacity-0 group-hover:opacity-100 hover:bg-orange-50 hover:text-orange-500 transition-all"
          >
            <Pencil size={14} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            aria-label={`Delete ${contact.name}`}
            onClick={(e) => { e.stopPropagation(); onDelete(contact.id); }}
            className="flex-shrink-0 p-1 rounded-lg text-stone-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
