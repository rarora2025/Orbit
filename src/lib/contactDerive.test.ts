import { describe, it, expect } from 'vitest';
import { getNextAction, followUpLabel } from './mockData';
import type { Contact, Status } from './mockData';

function makeContact(over: Partial<Contact> & { id: string; status: Status }): Contact {
  return {
    position: 1000, name: 'Vinit Shah', company: '', role: '', linkedinUrl: '',
    email: '', inquiry: '', notes: '', priority: 'Medium', score: 50, warmth: 'Medium',
    avatarColor: '', tags: [], lastContacted: '', nextAction: '', aiSummary: '',
    outreachAngle: '', suggestedMessage: '', interactions: [], ...over,
  };
}

describe('getNextAction', () => {
  it('uses the contact name for Send', () => {
    expect(getNextAction(makeContact({ id: 'a', status: 'Send' }))).toBe('Send first message to Vinit Shah');
  });
  it('maps each status to its action', () => {
    const cases: [Status, string][] = [
      ['Pending', 'Follow up if no response'],
      ['Response', 'Schedule meeting or reply'],
      ['Meeting Scheduled', 'Prepare for meeting'],
      ['Met', 'Add notes and decide follow-up'],
      ['Ghosted', 'Decide whether to revive'],
      ['Long-term', 'Keep warm over time'],
    ];
    for (const [status, expected] of cases) {
      expect(getNextAction(makeContact({ id: 's', status }))).toBe(expected);
    }
  });
});

describe('followUpLabel', () => {
  const today = new Date('2026-06-11T12:00:00Z');
  it('returns null when no follow-up date', () => {
    expect(followUpLabel(makeContact({ id: 'a', status: 'Pending' }), today)).toBeNull();
  });
  it('says "Follow up today" when pending and due today', () => {
    expect(followUpLabel(makeContact({ id: 'a', status: 'Pending', nextFollowUpAt: '2026-06-11T09:00:00Z' }), today)).toBe('Follow up today');
  });
  it('says overdue when pending and past', () => {
    expect(followUpLabel(makeContact({ id: 'a', status: 'Pending', nextFollowUpAt: '2026-06-01T09:00:00Z' }), today)).toBe('Follow-up overdue');
  });
  it('shows the date otherwise', () => {
    const label = followUpLabel(makeContact({ id: 'a', status: 'Pending', nextFollowUpAt: '2026-06-20T09:00:00Z' }), today);
    expect(label).toMatch(/^Follow up on /);
  });
  it('shows the plain date (no urgency) for non-Pending statuses, even when past', () => {
    const label = followUpLabel(makeContact({ id: 'a', status: 'Ghosted', nextFollowUpAt: '2026-06-01T09:00:00Z' }), today);
    expect(label).toMatch(/^Follow up on /);
  });
});
