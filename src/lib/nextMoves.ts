import type { Contact } from './mockData';

export type MoveKind = 'follow-up' | 'outreach' | 'reply';

export interface NextMove {
  /** Stable across renders so React keys and "approved" state survive recompute. */
  id: string;
  contactId: string;
  kind: MoveKind;
  /** Imperative headline, e.g. "Follow up with Nicholas Hull". */
  title: string;
  /** Short context, e.g. "ghosted 9 days". */
  detail: string;
  /** Prefilled text for the Draft action. */
  draft: string;
}

// How long a Pending thread can sit before it's worth a nudge.
const PENDING_NUDGE_DAYS = 5;

function daysSince(dateStr: string, today: Date): number {
  if (!dateStr) return 0;
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return 0;
  return Math.max(0, Math.floor((today.getTime() - then.getTime()) / 86_400_000));
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

interface Candidate {
  move: Omit<NextMove, 'id' | 'draft'> & { defaultDraft: string };
  weight: number;
}

// One move per contact: the single most useful next step given their status.
function candidateFor(contact: Contact, today: Date): Candidate | null {
  const { name, status } = contact;
  const days = daysSince(contact.lastContacted, today);

  switch (status) {
    case 'Ghosted':
      return {
        weight: 100 + days,
        move: {
          contactId: contact.id,
          kind: 'follow-up',
          title: `Follow up with ${name}`,
          detail: `ghosted ${plural(days, 'day')}`,
          defaultDraft: `Hi ${name.split(' ')[0]}, just floating this back to the top of your inbox — would still love to connect when you have a moment.`,
        },
      };
    case 'Response':
      return {
        weight: 85,
        move: {
          contactId: contact.id,
          kind: 'reply',
          title: `Reply to ${name}`,
          detail: days > 0 ? `replied ${plural(days, 'day')} ago` : 'replied today',
          defaultDraft: `Hi ${name.split(' ')[0]}, thanks for getting back to me! Would you be open to a quick call this week?`,
        },
      };
    case 'Send':
      return {
        weight: 70,
        move: {
          contactId: contact.id,
          kind: 'outreach',
          title: `Send first outreach to ${name}`,
          detail: 'no message sent yet',
          defaultDraft: `Hi ${name.split(' ')[0]}, I came across your work${contact.company ? ` at ${contact.company}` : ''} and would love to connect.`,
        },
      };
    case 'Pending':
      if (days <= PENDING_NUDGE_DAYS) return null;
      return {
        weight: 60 + days,
        move: {
          contactId: contact.id,
          kind: 'follow-up',
          title: `Follow up with ${name}`,
          detail: `waiting ${plural(days, 'day')}`,
          defaultDraft: `Hi ${name.split(' ')[0]}, following up on my last note — no rush, just keeping it on your radar.`,
        },
      };
    default:
      // Scheduled meetings, 'Met', and 'Long-term' relationships need no prompting.
      return null;
  }
}

/**
 * Derive the user's prioritized "next moves" from their contacts. Pure and
 * deterministic given `today`, so it's trivial to test and safe to recompute on
 * every render. Highest-urgency move first; capped so the list stays scannable.
 */
export function buildNextMoves(contacts: Contact[], today: Date = new Date(), limit = 8): NextMove[] {
  return contacts
    .map((c) => candidateFor(c, today))
    .filter((c): c is Candidate => c !== null)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map(({ move }) => {
      const contact = contacts.find((c) => c.id === move.contactId)!;
      const { defaultDraft, ...rest } = move;
      return {
        ...rest,
        id: `${move.contactId}:${move.kind}`,
        draft: contact.suggestedMessage?.trim() || defaultDraft,
      };
    });
}
