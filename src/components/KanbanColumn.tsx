'use client';

import { Contact, Status, columnConfig } from '@/lib/mockData';
import ContactCard from './ContactCard';
import { Plus } from 'lucide-react';

interface Props {
  status: Status;
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd?: () => void;
}

export default function KanbanColumn({ status, contacts, selectedId, onSelect, onAdd }: Props) {
  const config = columnConfig[status] ?? { dot: 'bg-stone-400', subtitle: '' };

  return (
    <div className="w-[252px] flex-shrink-0 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between mb-2.5 px-0.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
            <span className="text-[13px] font-semibold text-stone-800">{status}</span>
            <span className="text-[12px] text-stone-400 font-medium">{contacts.length}</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-0.5 ml-[14px]">{config.subtitle}</p>
        </div>
        <button
          onClick={onAdd}
          className="p-1 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors mt-0.5"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-4">
        {contacts.length === 0 ? (
          <div className="border border-dashed border-stone-200 rounded-xl h-16 flex items-center justify-center">
            <span className="text-[11px] text-stone-300">Empty</span>
          </div>
        ) : (
          contacts.map(contact => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onClick={() => onSelect(contact.id)}
              isSelected={selectedId === contact.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
