'use client';

import { useCRMStore } from '@/lib/store';
import { topicClusters } from '@/lib/mockData';
import { companyDisplayName } from '@/lib/companyLogo';
import { useMemo } from 'react';
import StatusPill from '@/components/StatusPill';
import { TrendingUp, AlertTriangle, Minus } from 'lucide-react';

type Strength = 'strong' | 'medium' | 'weak';

const strengthIcons: Record<Strength, typeof TrendingUp> = {
  strong: TrendingUp,
  medium: Minus,
  weak: AlertTriangle,
};

// Strength is the only signal a cluster carries, so it keeps a semantic accent
// (the same emerald / amber / red used in the legend). Everything else adopts
// the board's warm stone + white-card language so the views feel like one app.
const strengthBadge: Record<Strength, string> = {
  strong: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  weak: 'text-red-500 bg-red-50 border-red-200',
};

const strengthDot: Record<Strength, string> = {
  strong: 'bg-emerald-500',
  medium: 'bg-amber-500',
  weak: 'bg-red-500',
};

export default function TopicMap() {
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
    <>
      {/* Cluster grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {clustersWithContacts.map(cluster => {
          const strength = cluster.strength as Strength;
          const StrengthIcon = strengthIcons[strength];

          return (
            <div
              key={cluster.id}
              className="bg-white border border-stone-200/80 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
            >
              {/* Cluster header */}
              <div className="px-5 py-4 border-b border-stone-100">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${strengthDot[strength]}`} />
                    <h3 className="font-bold text-sm text-stone-800">{cluster.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full border ${strengthBadge[strength]}`}>
                      <StrengthIcon size={9} />
                      {strength.charAt(0).toUpperCase() + strength.slice(1)}
                    </span>
                    <span className="bg-stone-100 text-stone-500 text-[12px] font-bold px-2 py-0.5 rounded-full">
                      {cluster.contactObjects.length}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">{cluster.insight}</p>
              </div>

              {/* Contact cards — white rows on a faint stone surface, mirroring the
                  board's white cards sitting on the cream canvas. */}
              <div className="p-3 space-y-2 bg-stone-50/40">
                {cluster.contactObjects.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-stone-400">No contacts in this cluster yet</p>
                    <p className="text-[12px] text-stone-300 mt-0.5">Add contacts with this topic tag</p>
                  </div>
                ) : (
                  cluster.contactObjects.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => selectContact(contact.id)}
                      className="w-full bg-white border border-stone-200/70 hover:border-stone-300 rounded-xl px-3.5 py-3 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-stone-800 truncate">{contact.name}</p>
                            <p className="text-[12px] text-stone-500 truncate">{contact.role} · {companyDisplayName(contact.company)}</p>
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
                  <p className="text-[12px] text-stone-500 leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
