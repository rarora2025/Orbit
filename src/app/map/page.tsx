'use client';

import TopicMap from '@/components/TopicMap';
import { Map } from 'lucide-react';

export default function MapPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Map size={18} className="text-orange-500" />
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Topic Map</h1>
          </div>
          <p className="text-stone-500 text-sm">Your network grouped by domain cluster</p>
        </div>

        <TopicMap />
      </div>
    </div>
  );
}
