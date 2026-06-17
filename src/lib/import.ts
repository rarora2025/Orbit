// Shared contact-import types and the heuristic parser. Kept free of server-only
// code so it can run in the browser and act as the offline fallback when the
// AI parser (see import.actions.ts) is unavailable.

import type { Status, Warmth } from './mockData';

/** One parsed import row. The shape onboarding feeds into `addPeople`. Beyond
 *  contact details it can carry pipeline fields (status, warmth, role, tags)
 *  when the source — e.g. a CRM export with Status/Temp columns — provides them. */
export type ImportRow = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: Status;
  warmth?: Warmth;
  tags?: string[];
};

const STATUSES: Status[] = ['Send', 'Pending', 'Response', 'Ghosted', 'Meeting Scheduled', 'Met', 'Long-term'];

/** Match a free-form status string to one of the board statuses, or undefined. */
export function normalizeStatus(v: unknown): Status | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  return STATUSES.find((st) => st.toLowerCase() === s);
}

/** Normalize a warmth/temperature value to Low/Medium/High, or undefined.
 *  Accepts the words, a 1-3 number, or star ratings ("*", "**", "***"). */
export function normalizeWarmth(v: unknown): Warmth | undefined {
  if (typeof v === 'number') return v <= 1 ? 'Low' : v >= 3 ? 'High' : 'Medium';
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (!s) return undefined;
  if (s === 'low' || s === 'medium' || s === 'high') return (s[0].toUpperCase() + s.slice(1)) as Warmth;
  const stars = (s.match(/[*★]/g) ?? []).length;
  if (stars) return stars <= 1 ? 'Low' : stars >= 3 ? 'High' : 'Medium';
  const n = Number(s);
  if (!Number.isNaN(n)) return n <= 1 ? 'Low' : n >= 3 ? 'High' : 'Medium';
  return undefined;
}

/** Parse pasted/CSV contact lines: "Name, Company, email, phone" in any order
 *  after the name. Classifies fields heuristically; drops a header row. Used as
 *  the fallback when the AI parser can't run. */
export function parseContactLines(text: string): ImportRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\t,;]/).map((p) => p.trim()).filter(Boolean);
      const name = parts[0] ?? '';
      const row: ImportRow = { name };
      for (const p of parts.slice(1)) {
        if (p.includes('@')) row.email = p;
        else if (/^[+\d()\-.\s]{6,}$/.test(p)) row.phone = p;
        else if (!row.company) row.company = p;
      }
      return row;
    })
    .filter((r) => r.name && !/^(name|full name)$/i.test(r.name));
}

/** Normalize a raw object (e.g. from the AI parser's JSON) into an ImportRow,
 *  or null if it has no usable name. Trims strings and drops empty fields. */
export function toImportRow(raw: unknown): ImportRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = str(r.name);
  if (!name || /^(name|full name)$/i.test(name)) return null;
  const row: ImportRow = { name };
  const company = str(r.company);
  const email = str(r.email);
  const phone = str(r.phone);
  const role = str(r.role);
  if (company) row.company = company;
  if (email) row.email = email;
  if (phone) row.phone = phone;
  if (role) row.role = role;
  const status = normalizeStatus(r.status);
  const warmth = normalizeWarmth(r.warmth ?? r.temperature ?? r.temp);
  if (status) row.status = status;
  if (warmth) row.warmth = warmth;
  if (Array.isArray(r.tags)) {
    const tags = r.tags.map((t) => str(t)).filter(Boolean);
    if (tags.length) row.tags = tags;
  }
  return row;
}
