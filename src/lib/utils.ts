import { Status } from './mockData';

export function getStatusColor(status: Status): string {
  switch (status) {
    case 'Send': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'Response': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Ghosted': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-stone-100 text-stone-500 border-stone-200';
  }
}

export function getStatusDot(status: Status): string {
  switch (status) {
    case 'Send': return 'bg-blue-500';
    case 'Pending': return 'bg-yellow-400';
    case 'Response': return 'bg-emerald-500';
    case 'Ghosted': return 'bg-red-500';
    default: return 'bg-stone-400';
  }
}


export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Human "time ago" for a last-contacted date — "Today", "Yesterday",
 * "3 days ago", "2 weeks ago". Once it's older than a month it falls back to an
 * absolute date ("Mar 4") since "37 days ago" stops being useful.
 */
export function formatRelativeDate(dateStr: string): string {
  const days = getDaysSince(dateStr);
  if (isNaN(days)) return '';
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(dateStr);
}

export function getTagColor(tag: string): string {
  const colors = [
    'bg-blue-50 text-blue-600 border-blue-100',
    'bg-violet-50 text-violet-600 border-violet-100',
    'bg-emerald-50 text-emerald-600 border-emerald-100',
    'bg-amber-50 text-amber-600 border-amber-100',
    'bg-rose-50 text-rose-600 border-rose-100',
    'bg-teal-50 text-teal-600 border-teal-100',
    'bg-indigo-50 text-indigo-600 border-indigo-100',
    'bg-orange-50 text-orange-600 border-orange-100',
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
