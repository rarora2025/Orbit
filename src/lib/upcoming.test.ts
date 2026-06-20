import { describe, it, expect } from 'vitest';
import { buildUpcoming, contactDateBadge } from './upcoming';
import type { Contact, Status } from './mockData';

function makeContact(over: Partial<Contact> & { id: string; status: Status }): Contact {
  return {
    position: 1000, name: over.id, company: '', role: '', linkedinUrl: '', email: '',
    context: '', score: 0, warmth: 'Medium', avatarColor: '', tags: [], lastContacted: '',
    nextAction: '', aiSummary: '', outreachAngle: '', suggestedMessage: '', interactions: [], ...over,
  };
}

const today = new Date('2026-06-11T12:00:00Z');

describe('contactDateBadge', () => {
  it('returns null when there is no meeting or follow-up', () => {
    expect(contactDateBadge(makeContact({ id: 'a', status: 'Send' }), today)).toBeNull();
  });

  it('prefers an upcoming meeting over a follow-up', () => {
    const c = makeContact({
      id: 'a', status: 'Meeting Scheduled', nextFollowUpAt: '2026-06-20T12:00:00Z',
      interactions: [{ id: 'm', date: '2026-06-11', type: 'meeting_scheduled', content: '', dueAt: '2026-06-18T18:00:00Z' }],
    });
    const badge = contactDateBadge(c, today)!;
    expect(badge.kind).toBe('meeting');
    expect(badge.label).toMatch(/^Meeting /);
  });

  it('flags an overdue follow-up', () => {
    const c = makeContact({ id: 'a', status: 'Pending', nextFollowUpAt: '2026-06-01T12:00:00Z' });
    const badge = contactDateBadge(c, today)!;
    expect(badge).toMatchObject({ kind: 'follow-up', overdue: true, label: 'Follow-up overdue' });
  });

  it('shows a plain date for a future follow-up', () => {
    const c = makeContact({ id: 'a', status: 'Pending', nextFollowUpAt: '2026-06-20T12:00:00Z' });
    const badge = contactDateBadge(c, today)!;
    expect(badge).toMatchObject({ kind: 'follow-up', overdue: false });
    expect(badge.label).toMatch(/^Follow up /);
  });

  it('ignores a meeting once the contact has moved past Meeting Scheduled', () => {
    const c = makeContact({
      id: 'a', status: 'Met',
      interactions: [{ id: 'm', date: '2026-06-11', type: 'meeting_scheduled', content: '', dueAt: '2026-06-18T18:00:00Z' }],
    });
    expect(contactDateBadge(c, today)).toBeNull();
  });
});

describe('buildUpcoming', () => {
  it('collects meetings + follow-ups and sorts by date ascending', () => {
    const contacts = [
      makeContact({ id: 'later', status: 'Pending', nextFollowUpAt: '2026-06-20T12:00:00Z' }),
      makeContact({
        id: 'soon', status: 'Meeting Scheduled',
        interactions: [{ id: 'm', date: '2026-06-11', type: 'meeting_scheduled', content: '', dueAt: '2026-06-14T18:00:00Z' }],
      }),
    ];
    const items = buildUpcoming(contacts, today);
    expect(items.map((i) => i.contactId)).toEqual(['soon', 'later']);
    expect(items[0]).toMatchObject({ kind: 'meeting', contactName: 'soon' });
    expect(items[1]).toMatchObject({ kind: 'follow-up', contactName: 'later' });
  });

  it('returns an empty list when nothing is scheduled', () => {
    expect(buildUpcoming([makeContact({ id: 'a', status: 'Send' })], today)).toEqual([]);
  });
});
