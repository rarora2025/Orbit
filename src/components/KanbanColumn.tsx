'use client';

import { useState } from 'react';
import { Contact, Status, columnConfig } from '@/lib/mockData';
import ContactCard from './ContactCard';

// Thin drop-target line shown between cards while dragging.
function Indicator() {
  return <div className="h-0.5 rounded-full bg-orange-400 shadow-[0_0_0_3px_rgba(251,146,60,0.15)]" />;
}

interface Props {
  status: Status;
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit?: (id: string) => void;
  onMoveContact?: (contactId: string, status: Status, beforeId: string | null) => void;
  onDelete?: (id: string) => void;
}

export default function KanbanColumn({ status, contacts, selectedId, onSelect, onEdit, onMoveContact, onDelete }: Props) {
  const config = columnConfig[status] ?? { dot: 'bg-stone-400', bg: 'bg-stone-100', text: 'text-stone-600' };
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

  return (
    <div className="flex flex-col">
      {/* Header — a tinted pill so it reads clearly as a section, not a card.
          Sticks to the top while scrolling so you always know which column you're in. */}
      <div className="flex-shrink-0 sticky top-0 z-10 bg-white pt-4 pb-3">
        <div className={`inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full ${config.bg}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
          <span className={`text-[13px] font-semibold ${config.text}`}>{status}</span>
          <span className={`text-[11px] font-semibold ${config.text} bg-white/70 rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none`}>
            {contacts.length}
          </span>
        </div>
      </div>

      {/* Cards — each column scrolls on its own */}
      <div
        onDragOver={handleContainerDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`space-y-2 pb-6 pr-0.5 rounded-xl transition-colors ${
          isDragOver ? 'bg-orange-50/50' : ''
        }`}
      >
        {contacts.length === 0 ? (
          <div className={`border border-dashed rounded-xl h-16 flex items-center justify-center transition-colors ${
            isDragOver ? 'border-orange-300 bg-orange-50/60' : 'border-stone-200'
          }`}>
            <span className="text-[13px] text-stone-300">{isDragOver ? 'Drop here' : 'Empty'}</span>
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
                onEdit={onEdit}
                onDelete={onDelete}
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
