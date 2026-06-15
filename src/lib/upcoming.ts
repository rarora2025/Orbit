import type { Contact } from './mockData';

/** Local start-of-day epoch, for overdue comparisons that ignore the clock time. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function meetingShort(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * The contact's scheduled meeting time (latest `meeting_scheduled` with a
 * `dueAt`), but only while it's still in the Meeting Scheduled stage.
 */
export function meetingAt(c: Contact): string | undefined {
  if (c.status !== 'Meeting Scheduled') return undefined;
  return c.interactions
    .filter((i) => i.type === 'meeting_scheduled' && i.dueAt)
    .map((i) => i.dueAt!)
    .sort()
    .at(-1);
}

/**
 * The next date you need to act on this contact: their scheduled meeting time
 * (while in Meeting Scheduled), else their next follow-up. Undefined when there
 * is nothing scheduled. Used to sort the table by what's due soonest.
 */
export function nextContactAt(c: Contact): string | undefined {
  return meetingAt(c) ?? c.nextFollowUpAt;
}

export interface DateBadge {
  kind: 'meeting' | 'follow-up';
  overdue: boolean;
  label: string;
}

/** One date badge for a contact card: next meeting, else next follow-up; null if neither. */
export function contactDateBadge(c: Contact, now: Date = new Date()): DateBadge | null {
  const m = meetingAt(c);
  if (m) return { kind: 'meeting', overdue: false, label: `Meeting ${meetingShort(m)}` };
  if (c.nextFollowUpAt) {
    const overdue = new Date(c.nextFollowUpAt).getTime() < startOfDay(now);
    // A Send contact's date is a "send by", everyone else's is a "follow up".
    const verb = c.status === 'Send' ? 'Send' : 'Follow up';
    const label = overdue
      ? (c.status === 'Send' ? 'Overdue to send' : 'Follow-up overdue')
      : `${verb} ${dateShort(c.nextFollowUpAt)}`;
    return { kind: 'follow-up', overdue, label };
  }
  return null;
}

export interface UpcomingItem {
  contactId: string;
  contactName: string;
  kind: 'meeting' | 'follow-up';
  /** Short pill label shown beside the name: "Meeting", "Follow-up", or "Send". */
  tag: 'Meeting' | 'Follow-up' | 'Send';
  /** ISO datetime used for sorting. */
  at: string;
  overdue: boolean;
  /** Headline, e.g. "Meeting — Vinit Shah". */
  label: string;
  /** Human time, e.g. "Jun 18, 2:00 PM", "Jun 14", or "Overdue". */
  when: string;
}

/** A date-sorted agenda of upcoming meetings + follow-ups across all contacts. */
export function buildUpcoming(contacts: Contact[], now: Date = new Date()): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const c of contacts) {
    const m = meetingAt(c);
    if (m) {
      items.push({
        contactId: c.id, contactName: c.name, kind: 'meeting', tag: 'Meeting', at: m,
        overdue: new Date(m).getTime() < startOfDay(now),
        label: `Meeting — ${c.name}`, when: meetingShort(m),
      });
    }
    if (c.nextFollowUpAt) {
      const overdue = new Date(c.nextFollowUpAt).getTime() < startOfDay(now);
      const isSend = c.status === 'Send';
      const verb = isSend ? 'Send' : 'Follow up';
      items.push({
        contactId: c.id, contactName: c.name, kind: 'follow-up', tag: isSend ? 'Send' : 'Follow-up',
        at: c.nextFollowUpAt, overdue, label: `${verb} — ${c.name}`,
        when: overdue ? 'Overdue' : dateShort(c.nextFollowUpAt),
      });
    }
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}
