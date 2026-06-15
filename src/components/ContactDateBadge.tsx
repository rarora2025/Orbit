'use client';

import { Contact } from '@/lib/mockData';
import { contactDateBadge } from '@/lib/upcoming';
import { Calendar, Clock } from 'lucide-react';

/** The next-date pill (next meeting, else next follow-up) shown identically on
 *  the board card and in the table so both views read the same. Null when the
 *  contact has neither scheduled. */
export default function ContactDateBadge({ contact }: { contact: Contact }) {
  const badge = contactDateBadge(contact);
  if (!badge) return null;

  const tone =
    badge.kind === 'meeting'
      ? 'bg-indigo-50 text-indigo-700'
      : badge.overdue
        ? 'bg-red-50 text-red-600'
        : 'bg-amber-50 text-amber-700';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ${tone}`}>
      {badge.kind === 'meeting' ? <Calendar size={11} /> : <Clock size={11} />}
      {badge.label}
    </span>
  );
}
