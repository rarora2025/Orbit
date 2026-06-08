'use client';

import { Contact } from '@/lib/mockData';
import { formatDate, getDaysSince } from '@/lib/utils';
import StatusPill from './StatusPill';
import PriorityBadge from './PriorityBadge';
import TagChip from './TagChip';
import { ExternalLink, Clock } from 'lucide-react';

interface Props {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ContactTable({ contacts, selectedId, onSelect }: Props) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-3">
          <span className="text-2xl">🤝</span>
        </div>
        <p className="text-stone-600 font-medium text-sm">No contacts found</p>
        <p className="text-stone-400 text-xs mt-1">Add your first contact or adjust your filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="border-b border-stone-200/80">
            <th className="text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Person</th>
            <th className="text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Company / Role</th>
            <th className="text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Status</th>
            <th className="text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Priority</th>
            <th className="text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Last Contact</th>
            <th className="text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Topics</th>
            <th className="text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Next Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {contacts.map((contact) => {
            const days = getDaysSince(contact.lastContacted);
            const isSelected = selectedId === contact.id;
            const isOverdue = (contact.status === 'Pending' || contact.status === 'Meeting') && days > 7;

            return (
              <tr
                key={contact.id}
                onClick={() => onSelect(contact.id)}
                className={`group cursor-pointer transition-all duration-100 ${
                  isSelected
                    ? 'bg-stone-900 text-white'
                    : 'hover:bg-stone-50/80'
                }`}
              >
                {/* Person */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700'
                    }`}>
                      {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-stone-800'}`}>
                        {contact.name}
                      </p>
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`inline-flex items-center gap-0.5 text-[10px] mt-0.5 ${
                            isSelected ? 'text-white/60 hover:text-white' : 'text-stone-400 hover:text-blue-600'
                          }`}
                        >
                          <ExternalLink size={9} />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                </td>

                {/* Company / Role */}
                <td className="px-4 py-3.5">
                  <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-stone-700'}`}>
                    {contact.company}
                  </p>
                  <p className={`text-xs mt-0.5 ${isSelected ? 'text-white/60' : 'text-stone-400'}`}>
                    {contact.role}
                  </p>
                </td>

                {/* Status */}
                <td className="px-4 py-3.5">
                  {isSelected ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                      {contact.status}
                    </span>
                  ) : (
                    <StatusPill status={contact.status} size="sm" />
                  )}
                </td>

                {/* Priority */}
                <td className="px-4 py-3.5">
                  {isSelected ? (
                    <span className="text-xs text-white/80 font-medium">{contact.priority}</span>
                  ) : (
                    <PriorityBadge priority={contact.priority} />
                  )}
                </td>

                {/* Last Contact */}
                <td className="px-4 py-3.5">
                  <div className={`flex items-center gap-1 text-xs ${
                    isOverdue && !isSelected ? 'text-orange-600' : isSelected ? 'text-white/70' : 'text-stone-500'
                  }`}>
                    {isOverdue && !isSelected && <Clock size={11} />}
                    <span>{formatDate(contact.lastContacted)}</span>
                    <span className={isSelected ? 'text-white/40' : 'text-stone-300'}>·</span>
                    <span className={isSelected ? 'text-white/50' : 'text-stone-400'}>{days}d ago</span>
                  </div>
                </td>

                {/* Topics */}
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {contact.tags.slice(0, 2).map(tag => (
                      isSelected ? (
                        <span key={tag} className="inline-flex text-[10px] text-white/70 bg-white/10 border border-white/20 rounded-full px-2 py-0.5">
                          {tag}
                        </span>
                      ) : (
                        <TagChip key={tag} tag={tag} />
                      )
                    ))}
                    {contact.tags.length > 2 && (
                      <span className={`text-[10px] ${isSelected ? 'text-white/50' : 'text-stone-400'}`}>
                        +{contact.tags.length - 2}
                      </span>
                    )}
                  </div>
                </td>

                {/* Next Action */}
                <td className="px-4 py-3.5 max-w-[200px]">
                  <p className={`text-xs leading-relaxed line-clamp-2 ${isSelected ? 'text-white/70' : 'text-stone-500'}`}>
                    {contact.nextAction}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
