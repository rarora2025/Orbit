'use client';

import { Star } from 'lucide-react';
import { Contact } from '@/lib/mockData';

const TEMP_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

interface Props {
  warmth: Contact['warmth'];
  size?: number;
}

/** The 3-star temperature gauge used across the board, table, and detail panel
 *  so every view reads the same. Filled stars = warmth level (Low/Medium/High). */
export default function TemperatureStars({ warmth, size = 13 }: Props) {
  const temp = TEMP_LEVEL[warmth] ?? 1;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={`Temperature: ${warmth}`}
      aria-label={`Temperature ${warmth}`}
    >
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= temp ? 'fill-orange-400 text-orange-400' : 'fill-stone-100 text-stone-200'}
        />
      ))}
    </span>
  );
}
