'use client';

import { Contact } from '@/lib/mockData';
import LinkedInIcon from './LinkedInIcon';
import { Mail, Phone } from 'lucide-react';

/** Row of quick-reach icons in a fixed order: email · LinkedIn · phone. Only
 *  the channels a contact actually has are shown (the detail panel is where
 *  missing ones get a "No …" placeholder). Clicks don't bubble so they never
 *  trigger row/card selection. */
export default function ContactLinks({ contact, size = 14 }: { contact: Contact; size?: number }) {
  const channels = [
    {
      key: 'email',
      value: contact.email,
      href: `mailto:${contact.email}`,
      label: `Email ${contact.name}`,
      icon: <Mail size={size} />,
      hover: 'hover:bg-stone-100 hover:text-stone-600',
      external: false,
    },
    {
      key: 'linkedin',
      value: contact.linkedinUrl,
      href: contact.linkedinUrl,
      label: `${contact.name} on LinkedIn`,
      icon: <LinkedInIcon size={size} />,
      hover: 'hover:bg-[#0A66C2]/10 hover:text-[#0A66C2]',
      external: true,
    },
    {
      key: 'phone',
      value: contact.phone,
      href: `tel:${contact.phone}`,
      label: `Call ${contact.name}`,
      icon: <Phone size={size} />,
      hover: 'hover:bg-emerald-50 hover:text-emerald-600',
      external: false,
    },
  ];

  const available = channels.filter((ch) => ch.value);
  if (available.length === 0) {
    return <span className="text-[12px] text-stone-300">—</span>;
  }

  return (
    <div className="flex items-center gap-0.5">
      {available.map((ch) => (
        <a
          key={ch.key}
          href={ch.href}
          {...(ch.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          onClick={(e) => e.stopPropagation()}
          aria-label={ch.label}
          className={`p-1 rounded-md text-stone-400 transition-colors ${ch.hover}`}
        >
          {ch.icon}
        </a>
      ))}
    </div>
  );
}
