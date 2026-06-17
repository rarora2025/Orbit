import { describe, it, expect } from 'vitest';
import { buildNextMoves } from './nextMoves';
import type { Contact, Status } from './mockData';

function makeContact(over: Partial<Contact> & { id: string; status: Status }): Contact {
  return {
    position: 1000,
    name: 'Test Person',
    company: '',
    role: '',
    linkedinUrl: '',
    email: '',
    context: '',
    score: 50,
    warmth: 'Medium',
    avatarColor: '',
    tags: [],
    lastContacted: '2026-06-01',
    nextAction: '',
    aiSummary: '',
    outreachAngle: '',
    suggestedMessage: '',
    interactions: [],
    ...over,
  };
}

const TODAY = new Date('2026-06-10T12:00:00Z');

describe('buildNextMoves', () => {
  it('returns nothing for an empty network', () => {
    expect(buildNextMoves([], TODAY)).toEqual([]);
  });

  it('ignores contacts with no scheduled date', () => {
    const c = makeContact({ id: 's', status: 'Send' });
    expect(buildNextMoves([c], TODAY)).toEqual([]);
  });

  it('surfaces a follow-up that is due soon', () => {
    const c = makeContact({ id: 'p', name: 'Nicholas Hull', status: 'Pending', nextFollowUpAt: '2026-06-11' });
    const moves = buildNextMoves([c], TODAY);
    expect(moves).toHaveLength(1);
    expect(moves[0].contactId).toBe('p');
    expect(moves[0].kind).toBe('follow-up');
    expect(moves[0].title).toContain('Nicholas Hull');
  });

  it('surfaces an overdue date with an "overdue" detail', () => {
    const c = makeContact({ id: 'g', status: 'Ghosted', nextFollowUpAt: '2026-06-05' });
    const moves = buildNextMoves([c], TODAY);
    expect(moves).toHaveLength(1);
    expect(moves[0].detail.toLowerCase()).toContain('overdue');
  });

  it('does not surface dates beyond the few-day window', () => {
    const c = makeContact({ id: 'far', status: 'Pending', nextFollowUpAt: '2026-07-01' });
    expect(buildNextMoves([c], TODAY)).toEqual([]);
  });

  it('treats a Send contact with a send-by date as outreach', () => {
    const c = makeContact({ id: 's', status: 'Send', nextFollowUpAt: '2026-06-10' });
    const moves = buildNextMoves([c], TODAY);
    expect(moves[0].kind).toBe('outreach');
    expect(moves[0].draft.length).toBeGreaterThan(0);
  });

  it('never surfaces a scheduled-meeting contact, even with a due date', () => {
    const c = makeContact({ id: 'm', status: 'Meeting Scheduled', nextFollowUpAt: '2026-06-10' });
    expect(buildNextMoves([c], TODAY)).toEqual([]);
  });

  it('orders the soonest-due move first', () => {
    const soon = makeContact({ id: 'soon', status: 'Pending', nextFollowUpAt: '2026-06-11' });
    const overdue = makeContact({ id: 'overdue', status: 'Ghosted', nextFollowUpAt: '2026-06-04' });
    const moves = buildNextMoves([soon, overdue], TODAY);
    expect(moves.map((m) => m.contactId)).toEqual(['overdue', 'soon']);
  });

  it('prefers a contact-specific suggested message for the draft', () => {
    const c = makeContact({ id: 'g', status: 'Ghosted', nextFollowUpAt: '2026-06-09', suggestedMessage: 'Hey, circling back!' });
    const moves = buildNextMoves([c], TODAY);
    expect(moves[0].draft).toBe('Hey, circling back!');
  });
});
