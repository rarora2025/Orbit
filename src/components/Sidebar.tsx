'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, TableProperties, Map, Plus, ArrowRight } from 'lucide-react';
import OrbitLogo from './OrbitLogo';

const navItems = [
  { href: '/',           icon: LayoutGrid,      label: 'Pipeline'   },
  { href: '/insights',   icon: TableProperties, label: 'Insights'   },
  { href: '/map',        icon: Map,             label: 'Topic Map'  },
  { href: '/next-moves', icon: Plus,            label: 'Next Moves' },
  { href: '/outreach',   icon: ArrowRight,      label: 'Outreach'   },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen z-40 flex flex-col bg-[#faf9f5] border-r border-stone-200/80 overflow-hidden w-12 hover:w-52 transition-[width] duration-200 ease-out group">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2.5 py-4 border-b border-stone-200/60 flex-shrink-0">
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
              className={`flex items-center gap-3 px-1.5 py-2 rounded-lg transition-all duration-150 min-w-0 ${
                active
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
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
      <div className="flex items-center gap-3 px-2.5 py-4 border-t border-stone-200/60 flex-shrink-0">
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
