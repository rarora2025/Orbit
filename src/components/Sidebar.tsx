'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Sparkles, Map, Zap, PenLine, Users } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Pipeline', icon: LayoutDashboard },
  { href: '/insights', label: 'Insights', icon: Sparkles },
  { href: '/map', label: 'Topic Map', icon: Map },
  { href: '/next-moves', label: 'Next Moves', icon: Zap },
  { href: '/outreach', label: 'Outreach', icon: PenLine },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-[#faf9f5] border-r border-stone-200/80 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-stone-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold tracking-tight">P</span>
          </div>
          <div>
            <span className="font-semibold text-stone-800 text-sm tracking-tight">Pursuit</span>
            <span className="block text-[10px] text-stone-400 -mt-0.5 tracking-wide uppercase">CRM</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100/80'
              }`}
            >
              <Icon size={15} className={active ? 'text-white' : 'text-stone-400 group-hover:text-stone-600'} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-stone-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">R</span>
          </div>
          <div>
            <p className="text-xs font-medium text-stone-700">Rahul Arora</p>
            <p className="text-[10px] text-stone-400">Columbia &#39;25</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
