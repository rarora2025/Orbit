'use client';

import { Contact } from '@/lib/mockData';
import { formatShortDate } from '@/lib/utils';
import TagChip from './TagChip';

function WarmthBars({ warmth }: { warmth: 'Cool' | 'Warm' | 'Hot' }) {
  const filled = warmth === 'Cool' ? 1 : warmth === 'Warm' ? 2 : 3;
  return (
    <div className="flex items-end gap-[2px]">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className={`w-[3px] rounded-sm ${i <= filled ? 'bg-orange-400' : 'bg-stone-200'}`}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </div>
  );
}

interface Props {
  contact: Contact;
  onClick: () => void;
  isSelected?: boolean;
}

export default function ContactCard({ contact, onClick, isSelected }: Props) {
  const hasAction = !!contact.actionNote;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-3 cursor-pointer border transition-all ${
        isSelected
          ? 'border-orange-400 ring-1 ring-orange-200 shadow-md'
          : 'border-stone-200/60 hover:border-stone-300 hover:shadow-sm'
      } ${hasAction ? 'bg-[#fff7ed]' : 'bg-white'}`}
    >
      {/* Top row: avatar + name + score */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${contact.avatarColor}`}>
          {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-stone-900 leading-tight truncate">
            {contact.name}
          </p>
          <p className="text-[11px] text-stone-500 leading-tight mt-0.5 truncate">
            {contact.role}{contact.company ? ` · ${contact.company}` : ''}
          </p>
        </div>
        <div className="flex-shrink-0 w-[30px] h-[30px] rounded-full border-[1.5px] border-orange-400 flex items-center justify-center ml-1">
          <span className="text-[11px] font-bold text-orange-500 leading-none">{contact.score}</span>
        </div>
      </div>

      {/* Tags */}
      {contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {contact.tags.slice(0, 2).map(tag => <TagChip key={tag} tag={tag} />)}
        </div>
      )}

      {/* Warmth + last contact */}
      <div className="flex items-center gap-1.5">
        <WarmthBars warmth={contact.warmth} />
        <span className={`text-[11px] font-medium ${
          contact.warmth === 'Hot' ? 'text-orange-600'
          : contact.warmth === 'Warm' ? 'text-amber-600'
          : 'text-stone-500'
        }`}>
          {contact.warmth}
        </span>
        <span className="text-stone-300 text-[11px]">·</span>
        <span className="text-[11px] text-stone-400">last {formatShortDate(contact.lastContacted)}</span>
      </div>

      {/* Action note */}
      {hasAction && (
        <div className="mt-2 flex items-start gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-[4px] flex-shrink-0" />
          <p className="text-[11px] text-stone-700 leading-relaxed">{contact.actionNote}</p>
        </div>
      )}
    </div>
  );
}
