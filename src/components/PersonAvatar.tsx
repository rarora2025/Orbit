'use client';

import CompanyLogo from './CompanyLogo';
import type { Contact } from '@/lib/mockData';

interface Props {
  contact: Pick<Contact, 'name' | 'company' | 'avatarColor'>;
  /** Pixel diameter of the round avatar. */
  size?: number;
  className?: string;
}

function personInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

/** A person's avatar shown as their company's logo (logo -> favicon -> initials,
 *  handled by CompanyLogo). Falls back to the person's initials on their
 *  avatarColor when there's no company or no logo resolves. */
export default function PersonAvatar({ contact, size = 32, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 border border-stone-200 bg-white text-[11px] ${className}`}
      style={{ width: size, height: size }}
    >
      <CompanyLogo
        company={contact.company}
        fallbackInitial={personInitials(contact.name)}
        fallbackColor={contact.avatarColor || 'bg-stone-100 text-stone-500'}
        className="w-full h-full p-1"
      />
    </span>
  );
}
