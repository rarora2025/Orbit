import type { Contact } from './mockData';
import { nextContactAt } from './upcoming';

export type MoveKind = 'follow-up' | 'outreach' | 'reply';

export interface NextMove {
  /** Stable across renders so React keys and "approved" state survive recompute. */
  id: string;
  contactId: string;
  kind: MoveKind;
  /** Imperative headline, e.g. "Follow up with Nicholas Hull". */
  title: string;
  /** Short context — the due urgency, e.g. "Due today", "Overdue by 3 days". */
  detail: string;
  /** Prefilled text for the Draft action. */
  draft: string;
}

/** How far ahead a scheduled date counts as a "next move" rather than "upcoming". */
export const DUE_SOON_DAYS = 3;
const MS_PER_DAY = 86_400_000;

/** Cutoff (epoch ms) for "due soon": anything at/earlier than this — including
 *  everything overdue — is a next move; later than this is just upcoming. */
export function dueSoonCutoff(today: Date = new Date()): number {
  return today.getTime() + DUE_SOON_DAYS * MS_PER_DAY;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Human urgency for a due date relative to today. */
function dueDescription(dueISO: string, today: Date): string {
  const days = Math.round((startOfDay(new Date(dueISO).getTime()) - startOfDay(today.getTime())) / MS_PER_DAY);
  if (days < 0) return Math.abs(days) === 1 ? 'Overdue by 1 day' : `Overdue by ${Math.abs(days)} days`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

interface MoveContent {
  kind: MoveKind;
  title: string;
  defaultDraft: string;
}

/** The action + prefilled draft for a contact, by status. */
function moveContentFor(contact: Contact): MoveContent {
  const { name, status, company } = contact;
  const first = name.split(' ')[0];
  switch (status) {
    case 'Send':
      return {
        kind: 'outreach',
        title: `Send outreach to ${name}`,
        defaultDraft: `Hi ${first}, I came across your work${company ? ` at ${company}` : ''} and would love to connect.`,
      };
    case 'Response':
      return {
        kind: 'reply',
        title: `Reply to ${name}`,
        defaultDraft: `Hi ${first}, thanks for getting back to me! Would you be open to a quick call this week?`,
      };
    case 'Ghosted':
      return {
        kind: 'follow-up',
        title: `Follow up with ${name}`,
        defaultDraft: `Hi ${first}, just floating this back to the top of your inbox — would still love to connect when you have a moment.`,
      };
    case 'Met':
      return {
        kind: 'follow-up',
        title: `Check in with ${name}`,
        defaultDraft: `Hi ${first}, great catching up recently — wanted to keep the conversation going.`,
      };
    case 'Long-term':
      return {
        kind: 'follow-up',
        title: `Check in with ${name}`,
        defaultDraft: `Hi ${first}, it's been a while — hope you're doing well. Wanted to reconnect.`,
      };
    case 'Pending':
    default:
      return {
        kind: 'follow-up',
        title: `Follow up with ${name}`,
        defaultDraft: `Hi ${first}, following up on my last note — no rush, just keeping it on your radar.`,
      };
  }
}

/**
 * The user's "next moves": every contact whose next-action date (send-by or
 * follow-up) is overdue or due within `DUE_SOON_DAYS`. Soonest first. Meetings
 * are deliberately excluded — a scheduled meeting is "prepare", not "draft", and
 * lives in Upcoming. Pure and deterministic given `today`.
 */
export function buildNextMoves(contacts: Contact[], today: Date = new Date(), limit = 8): NextMove[] {
  const cutoff = dueSoonCutoff(today);
  return contacts
    .filter((c) => c.status !== 'Meeting Scheduled')
    .map((c) => {
      const due = nextContactAt(c);
      if (!due) return null;
      const dueMs = new Date(due).getTime();
      if (Number.isNaN(dueMs) || dueMs > cutoff) return null;
      return { contact: c, due, dueMs };
    })
    .filter((x): x is { contact: Contact; due: string; dueMs: number } => x !== null)
    .sort((a, b) => a.dueMs - b.dueMs)
    .slice(0, limit)
    .map(({ contact, due }) => {
      const { kind, title, defaultDraft } = moveContentFor(contact);
      return {
        id: `${contact.id}:${kind}`,
        contactId: contact.id,
        kind,
        title,
        detail: dueDescription(due, today),
        draft: contact.suggestedMessage?.trim() || defaultDraft,
      };
    });
}
