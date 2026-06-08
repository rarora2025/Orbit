'use client';

import { useCRMStore } from '@/lib/store';
import { topicClusters, networkGaps } from '@/lib/mockData';
import { Zap, AlertTriangle } from 'lucide-react';

export default function IntelligencePanel() {
  const { contacts } = useCRMStore();

  const followUpToday = contacts
    .filter(c => c.status === 'Pending')
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const maxContacts = Math.max(...topicClusters.map(c => c.contacts));

  return (
    <div className="w-[268px] flex-shrink-0 border-l border-stone-200/80 bg-[#faf9f5] flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-4 border-b border-stone-200/60">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center flex-shrink-0">
            <Zap size={11} className="text-white" fill="white" />
          </div>
          <span className="text-[13px] font-bold text-stone-900">Relationship Intelligence</span>
        </div>
        <p className="text-[11px] text-stone-400 ml-7">{contacts.length} contacts · live read</p>
      </div>

      {/* Network read */}
      <div className="mx-3 mt-3 bg-orange-50 border border-orange-100 rounded-xl p-3">
        <p className="text-[11px] text-stone-700 leading-relaxed">
          <span className="font-semibold">Network read.</span>{' '}
          You're concentrated in prediction markets — coherent for DraftIQ, but skewed to founders &amp; investors.
          Your most relevant cluster, <span className="font-medium">fantasy sports</span>, is your thinnest.
        </p>
      </div>

      {/* Network Clusters */}
      <div className="px-3 mt-4">
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
          Network Clusters
        </p>
        <div className="space-y-2.5">
          {topicClusters.map(cluster => (
            <div key={cluster.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-stone-800">{cluster.name}</span>
                <span className="text-[11px] text-stone-400">{cluster.contacts}</span>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${cluster.color}`}
                  style={{ width: `${(cluster.contacts / maxContacts) * 100}%` }}
                />
              </div>
              {cluster.gap && (
                <div className="flex items-start gap-1 mt-1">
                  <AlertTriangle size={10} className="text-orange-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-stone-500 leading-relaxed">{cluster.gap}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Follow up today */}
      {followUpToday.length > 0 && (
        <div className="px-3 mt-5">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
            Follow Up Today
          </p>
          <div className="space-y-2">
            {followUpToday.map(c => (
              <div key={c.id} className="flex items-center gap-2.5 bg-white border border-stone-200/60 rounded-xl px-3 py-2.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${c.avatarColor}`}>
                  {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-stone-900 truncate">{c.name}</p>
                  <p className="text-[10px] text-stone-400">
                    pending since {c.lastContacted.slice(5).replace('-', '/')}
                  </p>
                </div>
                <div className="w-8 h-6 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-orange-600">P{c.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add to close the gap */}
      <div className="px-3 mt-5 pb-6">
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
          Add to Close the Gap
        </p>
        <div className="flex flex-wrap gap-1.5">
          {networkGaps.map(gap => (
            <span
              key={gap}
              className="inline-flex items-center text-[11px] text-stone-600 bg-white border border-stone-200 rounded-full px-2.5 py-1 cursor-default hover:border-stone-300 transition-colors"
            >
              {gap}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
