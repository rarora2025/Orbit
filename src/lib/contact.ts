// Core contact model. Deliberately minimal: only the fields that matter, with
// score / temperature / tags produced by the AI signals generator (see
// contactSignals.ts) rather than entered by hand.
// Migration note: this slim type replaces the legacy Contact in mockData.ts;
// some files still import from mockData.ts and are being moved onto this module.
export type Status = 'Send' | 'Pending' | 'Response' | 'Ghosted';
export type Temperature = 'Low' | 'Medium' | 'High';

export interface Contact {
  id: string;
  name: string;
  company: string;
  status: Status;
  score: number;            // AI-generated fit score, 0–100
  temperature: Temperature; // AI-generated
  tags: string[];           // AI-generated, up to 2
  position: number;         // ordering within a board column
}

// Per-column accent + subtitle used by the Kanban board.
export const columnConfig: Record<Status, { dot: string; subtitle: string }> = {
  'Send':     { dot: 'bg-blue-500',    subtitle: 'Not reached out yet' },
  'Pending':  { dot: 'bg-yellow-400',  subtitle: 'Awaiting reply' },
  'Response': { dot: 'bg-emerald-500', subtitle: 'They replied' },
  'Ghosted':  { dot: 'bg-red-500',     subtitle: 'Gone cold' },
};
