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
    inquiry: '',
    notes: '',
    priority: 'Medium',
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

  it('flags a ghosted contact as a follow-up with the day count', () => {
    const c = makeContact({ id: 'g', name: 'Nicholas Hull', status: 'Ghosted', lastContacted: '2026-06-01' });
    const moves = buildNextMoves([c], TODAY);
    expect(moves).toHaveLength(1);
    expect(moves[0].contactId).toBe('g');
    expect(moves[0].kind).toBe('follow-up');
    expect(moves[0].title).toContain('Nicholas Hull');
    expect(moves[0].detail).toContain('9 days');
  });

  it('suggests first outreach for a Send contact', () => {
    const c = makeContact({ id: 's', name: 'Ali Hirsa', status: 'Send' });
    const moves = buildNextMoves([c], TODAY);
    expect(moves[0].kind).toBe('outreach');
    expect(moves[0].draft.length).toBeGreaterThan(0);
  });

  it('does not create a move for scheduled, met, or long-term contacts', () => {
    const scheduled = makeContact({ id: 'm', status: 'Meeting Scheduled' });
    const met = makeContact({ id: 'a', status: 'Met' });
    const longTerm = makeContact({ id: 'b', status: 'Long-term' });
    expect(buildNextMoves([scheduled, met, longTerm], TODAY)).toEqual([]);
  });

  it('ignores Pending contacts that were just contacted, nudges stale ones', () => {
    const fresh = makeContact({ id: 'f', status: 'Pending', lastContacted: '2026-06-09' });
    const stale = makeContact({ id: 'st', status: 'Pending', lastContacted: '2026-06-01' });
    const moves = buildNextMoves([fresh, stale], TODAY);
    expect(moves.map((m) => m.contactId)).toEqual(['st']);
  });

  it('orders ghosted ahead of fresh outreach', () => {
    const send = makeContact({ id: 's', status: 'Send' });
    const ghosted = makeContact({ id: 'g', status: 'Ghosted', lastContacted: '2026-05-20' });
    const moves = buildNextMoves([send, ghosted], TODAY);
    expect(moves[0].contactId).toBe('g');
  });

  it('prefers a contact-specific suggested message for the draft', () => {
    const c = makeContact({ id: 'g', status: 'Ghosted', suggestedMessage: 'Hey, circling back!' });
    const moves = buildNextMoves([c], TODAY);
    expect(moves[0].draft).toBe('Hey, circling back!');
  });
});
