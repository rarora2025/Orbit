'use client';

import { useCRMStore } from '@/lib/store';
import { topicClusters } from '@/lib/mockData';
import { useMemo } from 'react';
import StatusPill from '@/components/StatusPill';
import PriorityBadge from '@/components/PriorityBadge';
import { Map, TrendingUp, AlertTriangle, Minus } from 'lucide-react';

const clusterColors: Record<string, { bg: string; border: string; dot: string; header: string; badge: string }> = {
  blue: { bg: 'bg-blue-50/60', border: 'border-blue-200', dot: 'bg-blue-500', header: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  green: { bg: 'bg-emerald-50/60', border: 'border-emerald-200', dot: 'bg-emerald-500', header: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  purple: { bg: 'bg-violet-50/60', border: 'border-violet-200', dot: 'bg-violet-500', header: 'text-violet-700', badge: 'bg-violet-100 text-violet-700' },
  orange: { bg: 'bg-orange-50/60', border: 'border-orange-200', dot: 'bg-orange-500', header: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  amber: { bg: 'bg-amber-50/60', border: 'border-amber-200', dot: 'bg-amber-500', header: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  teal: { bg: 'bg-teal-50/60', border: 'border-teal-200', dot: 'bg-teal-500', header: 'text-teal-700', badge: 'bg-teal-100 text-teal-700' },
  pink: { bg: 'bg-pink-50/60', border: 'border-pink-200', dot: 'bg-pink-500', header: 'text-pink-700', badge: 'bg-pink-100 text-pink-700' },
};

const strengthIcons = {
  strong: TrendingUp,
  medium: Minus,
  weak: AlertTriangle,
};

const strengthColors = {
  strong: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  weak: 'text-red-500 bg-red-50 border-red-200',
};

export default function MapPage() {
  const { contacts, selectContact } = useCRMStore();

  const clustersWithContacts = useMemo(() => {
    return topicClusters.map(cluster => ({
      ...cluster,
      insight: cluster.gap ?? `${cluster.contacts} contacts in this cluster.`,
      contactObjects: contacts.filter(c =>
        c.tags.some(t => t.toLowerCase() === cluster.name.toLowerCase())
      ),
    }));
  }, [contacts]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Map size={18} className="text-teal-500" />
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Topic Map</h1>
          </div>
          <p className="text-stone-500 text-sm">Your network grouped by domain cluster</p>
        </div>

        {/* Cluster grid */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {clustersWithContacts.map(cluster => {
            const colorKey = cluster.color.replace('bg-', '').replace(/-\d+$/, '');
            const colors = clusterColors[colorKey] || clusterColors.blue;
            const StrengthIcon = strengthIcons[cluster.strength as keyof typeof strengthIcons];
            const strengthColor = strengthColors[cluster.strength as keyof typeof strengthColors];

            return (
              <div
                key={cluster.id}
                className={`${colors.bg} ${colors.border} border rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200`}
              >
                {/* Cluster header */}
                <div className={`px-5 py-4 border-b ${colors.border}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <h3 className={`font-bold text-sm ${colors.header}`}>{cluster.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${strengthColor}`}>
                        <StrengthIcon size={9} />
                        {cluster.strength.charAt(0).toUpperCase() + cluster.strength.slice(1)}
                      </span>
                      <span className={`${colors.badge} text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                        {cluster.contactObjects.length}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{cluster.insight}</p>
                </div>

                {/* Contact cards */}
                <div className="p-3 space-y-2">
                  {cluster.contactObjects.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-xs text-stone-400">No contacts in this cluster yet</p>
                      <p className="text-[10px] text-stone-300 mt-0.5">Add contacts with this topic tag</p>
                    </div>
                  ) : (
                    cluster.contactObjects.map(contact => (
                      <button
                        key={contact.id}
                        onClick={() => selectContact(contact.id)}
                        className="w-full bg-white/80 hover:bg-white border border-white/60 hover:border-stone-200 rounded-xl px-3.5 py-3 text-left transition-all duration-150 shadow-sm hover:shadow group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${colors.badge}`}>
                              {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-stone-800 truncate">{contact.name}</p>
                              <p className="text-[10px] text-stone-500 truncate">{contact.role} · {contact.company}</p>
                            </div>
                          </div>
                          <StatusPill status={contact.status} size="sm" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Cluster Strength Guide</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { strength: 'Strong', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Well-populated cluster with active contacts. Focus on deepening these relationships.' },
              { strength: 'Medium', icon: Minus, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Growing cluster with some momentum. Add more contacts and push existing ones forward.' },
              { strength: 'Weak', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', desc: 'Thin or underdeveloped cluster. Consider if this is a strategic gap that needs filling.' },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.strength} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={14} className={item.color} />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${item.color}`}>{item.strength}</p>
                    <p className="text-[10px] text-stone-500 leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
