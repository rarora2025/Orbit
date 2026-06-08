import { Status, Priority } from './mockData';

export function getStatusColor(status: Status): string {
  switch (status) {
    case 'To Send': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Responded': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Follow-up Needed': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Ghosted': return 'bg-red-100 text-red-700 border-red-200';
    case 'Closed': return 'bg-stone-100 text-stone-500 border-stone-200';
    default: return 'bg-stone-100 text-stone-500 border-stone-200';
  }
}

export function getStatusDot(status: Status): string {
  switch (status) {
    case 'To Send': return 'bg-blue-500';
    case 'Pending': return 'bg-amber-500';
    case 'Responded': return 'bg-emerald-500';
    case 'Follow-up Needed': return 'bg-orange-500';
    case 'Ghosted': return 'bg-red-500';
    case 'Closed': return 'bg-stone-400';
    default: return 'bg-stone-400';
  }
}

export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'Dream': return 'text-violet-600 bg-violet-50 border-violet-200';
    case 'High': return 'text-rose-600 bg-rose-50 border-rose-200';
    case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'Low': return 'text-stone-500 bg-stone-50 border-stone-200';
    default: return 'text-stone-500 bg-stone-50 border-stone-200';
  }
}

export function getPriorityIcon(priority: Priority): string {
  switch (priority) {
    case 'Dream': return '★';
    case 'High': return '↑↑';
    case 'Medium': return '↑';
    case 'Low': return '—';
    default: return '—';
  }
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
