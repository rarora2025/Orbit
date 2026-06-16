'use client';

import { Contact, Status } from '@/lib/mockData';
import { formatRelativeDate } from '@/lib/utils';
import StatusMenu from './StatusMenu';
import PersonAvatar from './PersonAvatar';
import TemperatureStars from './TemperatureStars';
import TemperatureInfo from './TemperatureInfo';
import ContactDateBadge from './ContactDateBadge';
import ContactLinks from './ContactLinks';
import { companyDisplayName } from '@/lib/companyLogo';
import { Trash2 } from 'lucide-react';

interface Props {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChangeStatus: (id: string, status: Status) => void;
  onDelete: (id: string) => void;
}

const HEADERS = ['Person', 'Company / Role', 'Status', 'Temperature', 'Date', 'Reach out'];

export default function ContactTable({ contacts, selectedId, onSelect, onChangeStatus, onDelete }: Props) {
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
                  {h === 'Temperature' ? (
                    <span className="inline-flex items-center gap-1.5">
                      {h}
                      <TemperatureInfo />
                    </span>
                  ) : (
                    h
                  )}
                </th>
              ))}
              {/* Actions (delete) — no visible label */}
              <th className="w-10 px-2 py-2.5" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const isSelected = selectedId === contact.id;
              const companyLabel = companyDisplayName(contact.company);

              return (
                <tr
                  key={contact.id}
                  onClick={() => onSelect(contact.id)}
                  className={`table-row group cursor-pointer border-b border-stone-100 last:border-0 transition-colors ${
                    isSelected ? 'bg-orange-50/70' : 'hover:bg-stone-50/70'
                  }`}
                >
                  {/* Person */}
                  <td className="px-4 py-3 relative">
                    {isSelected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-orange-400 rounded-r" />}
                    <div className="flex items-center gap-3">
                      <PersonAvatar contact={contact} size={32} className="transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5" />
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-stone-800 leading-tight truncate">
                          {contact.name}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Company / Role — logo now lives on the person avatar (Person column) */}
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-stone-700 truncate">{companyLabel || '—'}</p>
                      <p className="text-[13px] text-stone-400 truncate">{contact.role}</p>
                    </div>
                  </td>

                  {/* Status — click to change (the menu stops propagation so it doesn't open the row) */}
                  <td className="px-4 py-3">
                    <StatusMenu
                      status={contact.status}
                      size="sm"
                      onChange={(s) => onChangeStatus(contact.id, s)}
                    />
                  </td>

                  {/* Temperature — same star gauge as the board */}
                  <td className="px-4 py-3">
                    <span className="inline-flex transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5">
                      <TemperatureStars warmth={contact.warmth} size={15} />
                    </span>
                  </td>

                  {/* Last contacted (relative) + next follow-up — same badge as the board */}
                  <td className="px-4 py-3">
                    <div className="space-y-1.5">
                      <div className="text-[13px] text-stone-600">
                        {contact.lastContacted ? formatRelativeDate(contact.lastContacted) : <span className="text-stone-300">Not contacted yet</span>}
                      </div>
                      <ContactDateBadge contact={contact} />
                    </div>
                  </td>

                  {/* Reach out — quick links (LinkedIn · email · phone) */}
                  <td className="px-4 py-3">
                    <ContactLinks contact={contact} size={16} />
                  </td>

                  {/* Delete — revealed on row hover */}
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Delete ${contact.name}`}
                      onClick={(e) => { e.stopPropagation(); onDelete(contact.id); }}
                      className="p-1.5 rounded-lg text-stone-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
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
