'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, MessageCircle } from 'lucide-react';
import { UserButton, useUser } from '@clerk/nextjs';
import OrbitLogo from './OrbitLogo';

const navItems = [
  { href: '/',     icon: LayoutGrid,    label: 'Dashboard' },
  { href: '/chat', icon: MessageCircle, label: 'Chat'      },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <header className="fixed left-3 right-3 top-3 z-40 flex items-center rounded-2xl bg-white/40 backdrop-blur-2xl backdrop-saturate-150 border border-white/50 ring-1 ring-black/5 shadow-lg shadow-stone-500/10 h-12 px-3">
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <OrbitLogo size={22} />
        <span className="text-sm font-semibold text-stone-800 tracking-tight">Orbit</span>
      </div>

      {/* Nav — absolutely centered in the bar */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 ${
                active
                  ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                  : 'text-stone-500 hover:text-orange-600 hover:bg-orange-50/70'
              }`}
            >
              <Icon size={14} className="flex-shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <UserName />
        <UserButton
          appearance={{ elements: { rootBox: 'w-7 h-7', avatarBox: 'w-7 h-7' } }}
        />
      </div>
    </header>
  );
}

function UserName() {
  const { user } = useUser();
  if (!user) return null;
  return (
    <span className="hidden sm:block text-[13px] font-medium text-stone-700 whitespace-nowrap leading-none">
      {user.fullName ?? user.primaryEmailAddress?.emailAddress ?? 'Account'}
    </span>
  );
}
