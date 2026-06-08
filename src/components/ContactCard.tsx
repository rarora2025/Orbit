'use client';

import { useState } from 'react';
import { Contact } from '@/lib/mockData';
import CompanyLogo from './CompanyLogo';
import { Trash2 } from 'lucide-react';

interface Props {
  contact: Contact;
  onClick: () => void;
  isSelected?: boolean;
  onDelete?: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const TEMP_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };
const SCORE_BASE: Record<Contact['warmth'], number> = { Low: 50, Medium: 68, High: 85 };

// AI fit score derived from temperature — base by warmth plus a deterministic
// per-contact jitter so cards vary but always trend with temp.
function aiScore(contact: Contact): number {
  let hash = 0;
  for (const ch of contact.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SCORE_BASE[contact.warmth] + (hash % 10);
}

const MAX_TAGS = 3;

export default function ContactCard({ contact, onClick, isSelected, onDelete, draggable, onDragStart, onDragEnd }: Props) {
  const [dragging, setDragging] = useState(false);
  const temp = TEMP_LEVEL[contact.warmth] ?? 1;
  const score = aiScore(contact);
  const initial = (contact.company || contact.name || '?').charAt(0).toUpperCase();
  const subtitle = [contact.role, contact.company].filter(Boolean).join(' · ');
  const visibleTags = contact.tags.slice(0, MAX_TAGS);
  const extraTags = contact.tags.length - visibleTags.length;

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
      {/* Header: brand logo · name/role · fit score */}
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
          className="flex-shrink-0 w-8 h-8 rounded-full border-[1.5px] border-orange-400 flex items-center justify-center"
          title={`AI fit score ${score} · based on temperature`}
        >
          <span className="text-[13px] font-bold text-orange-500 leading-none">{score}</span>
        </div>
      </div>

      {/* Footer: temperature + delete, then AI tags */}
      <div className="mt-2.5 pt-2.5 border-t border-stone-100">
        <div className="flex items-center gap-1.5">
          <span
            title={`Temperature: ${contact.warmth}`}
            aria-label={`Temperature ${contact.warmth}`}
            className="font-bold text-[15px] leading-none tracking-[0.15em] select-none"
          >
            <span className="text-orange-500">{'*'.repeat(temp)}</span>
            <span className="text-stone-300">{'*'.repeat(3 - temp)}</span>
          </span>
          {onDelete && (
            <button
              type="button"
              aria-label={`Delete ${contact.name}`}
              onClick={(e) => { e.stopPropagation(); onDelete(contact.id); }}
              className="ml-auto p-1 rounded-lg text-stone-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-stone-100 text-stone-600 text-[11px] font-medium px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="inline-flex items-center rounded-full text-stone-400 text-[11px] font-medium px-1 py-0.5">
                +{extraTags}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
