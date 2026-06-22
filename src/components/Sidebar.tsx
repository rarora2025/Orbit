'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutGrid, MessageCircle, Compass } from 'lucide-react';
import { UserButton, useUser } from '@clerk/nextjs';
import OrbitLogo from './OrbitLogo';

const navItems = [
  { href: '/',          icon: Compass,       label: 'Insights'  },
  { href: '/dashboard', icon: LayoutGrid,    label: 'Dashboard' },
  { href: '/chat',      icon: MessageCircle, label: 'Chat'      },
];

/**
 * True once any vertical scroll container on the page is scrolled past
 * `threshold`. The window itself never scrolls in this app — each page scrolls
 * inside its own inner container — so we listen in the capture phase, which sees
 * scroll events from any descendant even though they don't bubble. Horizontal
 * card rails (overflow-x-auto) are ignored since they aren't vertical scrollers.
 */
function useScrolled(threshold = 16) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = (e: Event) => {
      const el = e.target as Element | null;
      if (!el || el.scrollHeight <= el.clientHeight) return; // not a vertical scroller
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrolled((prev) => {
          const next = el.scrollTop > threshold;
          return next === prev ? prev : next;
        });
      });
    };
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return scrolled;
}

export default function Sidebar() {
  const pathname = usePathname();
  const scrolled = useScrolled();

  return (
    <header
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-40 flex items-center rounded-2xl border border-white/50 ring-1 ring-black/5 transition-[width,height,padding,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] backdrop-blur-2xl ${
        scrolled
          ? 'w-[min(64rem,calc(100%_-_1.5rem))] h-11 px-2.5 bg-white/60 backdrop-saturate-200 shadow-xl shadow-stone-500/20'
          : 'w-[calc(100%_-_1.5rem)] h-12 px-3 bg-white/40 backdrop-saturate-150 shadow-lg shadow-stone-500/10'
      }`}
    >
      {/* Logo */}
      <Link href="/" title="Insights" className="flex items-center gap-2 flex-shrink-0">
        <OrbitLogo size={22} />
        <span className="text-sm font-semibold text-stone-800 tracking-tight">Orbit</span>
      </Link>

      {/* Nav — absolutely centered in the bar. Labels collapse to icon-only on
          small screens so the centered group never collides with the logo or
          profile on a phone. */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 ${
                active
                  ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                  : 'text-stone-500 hover:text-orange-600 hover:bg-orange-50/70'
              }`}
            >
              <Icon size={14} className="flex-shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">{label}</span>
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
