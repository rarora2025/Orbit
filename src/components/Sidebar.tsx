'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, TableProperties, Map, Plus, ArrowRight } from 'lucide-react';

const navItems = [
  { href: '/',           icon: LayoutGrid,       label: 'Pipeline' },
  { href: '/insights',   icon: TableProperties,  label: 'Insights' },
  { href: '/map',        icon: Map,              label: 'Topic Map' },
  { href: '/next-moves', icon: Plus,             label: 'Next Moves' },
  { href: '/outreach',   icon: ArrowRight,       label: 'Outreach' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-12 bg-[#faf9f5] border-r border-stone-200/80 flex flex-col items-center z-40">
      {/* Logo */}
      <div className="pt-4 pb-3 w-full flex justify-center border-b border-stone-200/60">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold">P</span>
        </div>
      </div>

      {/* Nav icons */}
      <nav className="flex-1 flex flex-col items-center pt-3 gap-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                active
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Icon size={15} />
            </Link>
          );
        })}
      </nav>

      {/* User dot */}
      <div className="pb-4">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <span className="text-white text-[10px] font-semibold">R</span>
        </div>
      </div>
    </aside>
  );
}
