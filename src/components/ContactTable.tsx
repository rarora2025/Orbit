'use client';

import { Contact, getNextAction } from '@/lib/mockData';
import { formatShortDate, getDaysSince } from '@/lib/utils';
import StatusPill from './StatusPill';
import PriorityBadge from './PriorityBadge';
import TagChip from './TagChip';
import CompanyLogo from './CompanyLogo';
import { companyDisplayName } from '@/lib/companyLogo';
import { ExternalLink, Clock } from 'lucide-react';

interface Props {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const HEADERS = ['Person', 'Company / Role', 'Status', 'Priority', 'Score', 'Last contact', 'Next action'];

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
    <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-200/70">
              {HEADERS.map(h => (
                <th
                  key={h}
                  className="text-left text-[12px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-2.5 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const days = getDaysSince(contact.lastContacted);
              const isSelected = selectedId === contact.id;
              const isOverdue = contact.status === 'Pending' && days > 7;
              const companyLabel = companyDisplayName(contact.company);
              const companyInitial = (companyLabel || contact.name).charAt(0).toUpperCase();

              return (
                <tr
                  key={contact.id}
                  onClick={() => onSelect(contact.id)}
                  className={`group cursor-pointer border-b border-stone-100 last:border-0 transition-colors ${
                    isSelected ? 'bg-orange-50/70' : 'hover:bg-stone-50/70'
                  }`}
                >
                  {/* Person */}
                  <td className="px-4 py-3 relative">
                    {isSelected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-orange-400 rounded-r" />}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                        {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-stone-800 leading-tight truncate">
                          {contact.name}
                        </p>
                        {contact.linkedinUrl && (
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-[12px] mt-0.5 text-stone-400 hover:text-blue-600"
                          >
                            <ExternalLink size={9} />
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Company / Role */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {contact.company && (
                        <div className="w-7 h-7 rounded-md border border-stone-200 bg-white flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <CompanyLogo
                            company={contact.company}
                            fallbackInitial={companyInitial}
                            fallbackColor="text-stone-400"
                            className="w-full h-full p-1"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-stone-700 truncate">{companyLabel || '—'}</p>
                        <p className="text-[13px] text-stone-400 truncate">{contact.role}</p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusPill status={contact.status} size="sm" />
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-3">
                    <PriorityBadge priority={contact.priority} />
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3">
                    <div className="w-[30px] h-[30px] rounded-full border-[1.5px] border-orange-400 flex items-center justify-center">
                      <span className="text-[13px] font-bold text-orange-500 leading-none">{contact.score}</span>
                    </div>
                  </td>

                  {/* Last contact */}
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-1 text-[14px] ${isOverdue ? 'text-orange-600 font-medium' : 'text-stone-500'}`}>
                      {isOverdue && <Clock size={11} />}
                      <span>{formatShortDate(contact.lastContacted)}</span>
                      <span className="text-stone-300">·</span>
                      <span className="text-stone-400">{days}d</span>
                    </div>
                  </td>

                  {/* Next action */}
                  <td className="px-4 py-3 max-w-[240px]">
                    {contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {contact.tags.slice(0, 2).map(tag => <TagChip key={tag} tag={tag} />)}
                      </div>
                    )}
                    <p className="text-[13px] text-stone-500 leading-relaxed line-clamp-2">
                      {getNextAction(contact)}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
