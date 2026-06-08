'use client';

import { useState } from 'react';
import { Contact, Status, columnConfig } from '@/lib/mockData';
import ContactCard from './ContactCard';
import { Plus } from 'lucide-react';

interface Props {
  status: Status;
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  onMoveContact?: (contactId: string, status: Status, beforeId: string | null) => void;
}

export default function KanbanColumn({ status, contacts, selectedId, onSelect, onAdd, onMoveContact }: Props) {
  const config = columnConfig[status] ?? { dot: 'bg-stone-400', subtitle: '' };
  const draggable = !!onMoveContact;

  // Index in `contacts` where a dropped card would be inserted (0..length), or null.
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function clearDrop() {
    setDropIndex(null);
  }

  // Hovering a specific card: insert above or below it based on the cursor's half.
  function handleCardDragOver(e: React.DragEvent, index: number) {
    if (!draggable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const next = after ? index + 1 : index;
    setDropIndex((prev) => (prev === next ? prev : next));
  }

  // Hovering the empty area of the column (below the last card) → drop at the end.
  function handleContainerDragOver(e: React.DragEvent) {
    if (!draggable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (e.target === e.currentTarget) setDropIndex(contacts.length);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear when the cursor actually leaves the column, not its children.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    clearDrop();
  }

  function handleDrop(e: React.DragEvent) {
    if (!draggable) return;
    e.preventDefault();
    const contactId = e.dataTransfer.getData('text/plain');
    const idx = dropIndex;
    clearDrop();
    if (!contactId) return;
    const beforeId = idx != null && idx < contacts.length ? contacts[idx].id : null;
    onMoveContact!(contactId, status, beforeId);
  }

  const isDragOver = dropIndex !== null;
  const Indicator = () => (
    <div className="h-0.5 rounded-full bg-orange-400 shadow-[0_0_0_3px_rgba(251,146,60,0.15)]" />
  );

  return (
    <div className="w-[252px] flex-shrink-0 flex flex-col">
      {/* Header — sticks to the top while the whole board scrolls vertically */}
      <div className="sticky top-0 z-10 flex items-start justify-between px-0.5 pt-1 pb-2.5 bg-[#faf9f5]/90 backdrop-blur-sm">
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
      <div
        onDragOver={handleContainerDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`space-y-2 pb-4 min-h-[60px] rounded-xl transition-colors ${
          isDragOver ? 'bg-orange-50/50' : ''
        }`}
      >
        {contacts.length === 0 ? (
          <div className={`border border-dashed rounded-xl h-16 flex items-center justify-center transition-colors ${
            isDragOver ? 'border-orange-300 bg-orange-50/60' : 'border-stone-200'
          }`}>
            <span className="text-[11px] text-stone-300">{isDragOver ? 'Drop here' : 'Empty'}</span>
          </div>
        ) : (
          contacts.map((contact, i) => (
            <div key={contact.id} onDragOver={(e) => handleCardDragOver(e, i)}>
              {dropIndex === i && (
                <div className="mb-2">
                  <Indicator />
                </div>
              )}
              <ContactCard
                contact={contact}
                onClick={() => onSelect(contact.id)}
                isSelected={selectedId === contact.id}
                draggable={draggable}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', contact.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={clearDrop}
              />
            </div>
          ))
        )}
        {contacts.length > 0 && dropIndex === contacts.length && <Indicator />}
      </div>
    </div>
  );
}
