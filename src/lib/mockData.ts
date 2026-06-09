export type Status =
  | 'Send'
  | 'Pending'
  | 'Response'
  | 'Ghosted'
  | 'Meeting Scheduled'
  | 'Met'
  | 'Long-term';
export type Priority = 'Low' | 'Medium' | 'High' | 'Dream';
export type Warmth = 'Low' | 'Medium' | 'High';

export interface Interaction {
  id: string;
  date: string;
  type: 'sent' | 'received' | 'note' | 'meeting';
  content: string;
}

export interface Contact {
  id: string;
  position: number;        // ordering within a board column (durable across reloads)
  name: string;
  company: string;
  role: string;
  linkedinUrl: string;
  email: string;
  inquiry: string;
  notes: string;
  status: Status;
  /** Why the user cares about this person (e.g. "internship help", "investor"). */
  relationshipGoal?: string;
  priority: Priority;
  score: number;
  warmth: Warmth;
  avatarColor: string;
  tags: string[];
  lastContacted: string;
  nextAction: string;
  actionNote?: string;
  aiSummary: string;
  outreachAngle: string;
  suggestedMessage: string;
  interactions: Interaction[];
}

export const columnConfig: Record<string, { dot: string; bg: string; text: string }> = {
  'Send':              { dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700'    },
  'Pending':           { dot: 'bg-yellow-400',  bg: 'bg-amber-50',   text: 'text-amber-700'   },
  'Response':          { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'Ghosted':           { dot: 'bg-red-500',     bg: 'bg-red-50',     text: 'text-red-700'     },
  'Meeting Scheduled': { dot: 'bg-indigo-500',  bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
  'Met':               { dot: 'bg-teal-500',    bg: 'bg-teal-50',    text: 'text-teal-700'    },
  'Long-term':         { dot: 'bg-purple-500',  bg: 'bg-purple-50',  text: 'text-purple-700'  },
};

/** Board column order, left → right. Shared by the dashboard and any view that
 *  needs the canonical pipeline sequence. */
export const BOARD_STATUSES: Status[] = [
  'Send', 'Pending', 'Response', 'Ghosted', 'Meeting Scheduled', 'Met', 'Long-term',
];

/**
 * How the board lays out statuses into columns. Some pipeline stages are
 * either/or branches (a contact is Response *or* Ghosted) or terminal states
 * (Met, Long-term), so they share a column and stack vertically. Fewer columns
 * means each can flex to fill the width instead of overflowing the screen.
 */
export const BOARD_COLUMNS: { key: string; label: string; statuses: Status[] }[] = [
  { key: 'send',      label: 'To send',   statuses: ['Send'] },
  { key: 'pending',   label: 'Pending',   statuses: ['Pending'] },
  { key: 'replied',   label: 'Replied',   statuses: ['Response', 'Ghosted'] },
  { key: 'meeting',   label: 'Meeting',   statuses: ['Meeting Scheduled', 'Met'] },
  { key: 'longterm',  label: 'Long-term', statuses: ['Long-term'] },
];

export const topicClusters = [
  { id: 'prediction-markets', name: 'Prediction Markets', contacts: 11, strength: 'strong', color: 'bg-emerald-600' },
  { id: 'vc-funds',           name: 'VC / Funds',         contacts: 6,  strength: 'strong', color: 'bg-emerald-600' },
  { id: 'sports-gaming',      name: 'Sports Gaming',      contacts: 3,  strength: 'medium', color: 'bg-amber-500'  },
  { id: 'operators',          name: 'Operators',          contacts: 3,  strength: 'medium', color: 'bg-amber-500'  },
  { id: 'fantasy-sports',     name: 'Fantasy Sports',     contacts: 2,  strength: 'weak',   color: 'bg-orange-500', gap: 'Your most relevant cluster for DraftIQ — and weakest.' },
  { id: 'legal-policy',       name: 'Legal / Policy',     contacts: 1,  strength: 'weak',   color: 'bg-orange-500', gap: 'Compliance matters for sports betting.' },
  { id: 'academic',           name: 'Academic',           contacts: 1,  strength: 'weak',   color: 'bg-emerald-600' },
];

export const networkGaps = [
  'Fantasy football commissioners',
  'DraftKings / FanDuel product alumni',
  'Campus sports creators',
  'Discord community owners',
];
