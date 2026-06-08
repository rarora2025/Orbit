'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Map } from 'lucide-react';
import OrbitLogo from './OrbitLogo';

const navItems = [
  { href: '/',    icon: LayoutGrid, label: 'Pipeline'  },
  { href: '/map', icon: Map,        label: 'Topic Map' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-2.5 top-2.5 bottom-2.5 z-40 flex flex-col rounded-[1.75rem] bg-white/40 backdrop-blur-2xl backdrop-saturate-150 border border-white/50 ring-1 ring-black/5 shadow-xl shadow-stone-500/15 overflow-hidden w-14 hover:w-56 transition-[width] duration-300 ease-out group">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-white/40 flex-shrink-0">
        <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
          <OrbitLogo size={26} />
        </div>
        <span className="text-sm font-semibold text-stone-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
          Orbit
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col px-2 pt-3 gap-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-all duration-150 min-w-0 ${
                active
                  ? 'bg-stone-900/90 text-white shadow-md shadow-stone-900/20'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-white/60'
              }`}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span className="text-[15px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 px-3 py-4 border-t border-white/40 flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[12px] font-semibold">R</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 min-w-0">
          <p className="text-[14px] font-medium text-stone-700 whitespace-nowrap">Rahul Arora</p>
          <p className="text-[12px] text-stone-400 whitespace-nowrap">Columbia '25</p>
        </div>
      </div>
    </aside>
  );
}
