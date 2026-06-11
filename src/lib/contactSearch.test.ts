import { describe, it, expect } from 'vitest';
import { filterContacts } from './contactSearch';
import type { Contact } from './mockData';

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: '1',
    position: 0,
    name: 'Jane Doe',
    company: 'Acme',
    role: 'Engineer',
    linkedinUrl: '',
    email: '',
    notes: 'private notes',
    status: 'Send',
    score: 50,
    warmth: 'Low',
    avatarColor: '',
    tags: [],
    lastContacted: '',
    nextAction: '',
    aiSummary: '',
    outreachAngle: '',
    suggestedMessage: '',
    interactions: [],
    ...overrides,
  };
}

const contacts: Contact[] = [
  makeContact({ id: '1', name: 'Ali Hirsa', company: 'Columbia', role: 'Professor', tags: ['Academic', 'Prediction Markets'] }),
  makeContact({ id: '2', name: 'Shayne Coplan', company: 'Polymarket', role: 'CEO', tags: ['Founder'] }),
  makeContact({ id: '3', name: 'Jay Deuskar', company: 'Columbia', role: 'Student', tags: [] }),
];

describe('filterContacts', () => {
  it('returns all contacts unchanged for an empty query', () => {
    expect(filterContacts(contacts, '')).toBe(contacts);
    expect(filterContacts(contacts, '   ')).toBe(contacts);
  });

  it('matches on name (case-insensitive substring)', () => {
    expect(filterContacts(contacts, 'shayne').map(c => c.id)).toEqual(['2']);
    expect(filterContacts(contacts, 'HIRSA').map(c => c.id)).toEqual(['1']);
  });

  it('matches on company, returning every contact there', () => {
    expect(filterContacts(contacts, 'columbia').map(c => c.id)).toEqual(['1', '3']);
  });

  it('matches on role', () => {
    expect(filterContacts(contacts, 'ceo').map(c => c.id)).toEqual(['2']);
  });

  it('matches on tags', () => {
    expect(filterContacts(contacts, 'prediction').map(c => c.id)).toEqual(['1']);
  });

  it('does not match free-text fields that are out of scope', () => {
    expect(filterContacts(contacts, 'private')).toEqual([]);
  });

  it('trims surrounding whitespace from the query', () => {
    expect(filterContacts(contacts, '  coplan  ').map(c => c.id)).toEqual(['2']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterContacts(contacts, 'zzzzz')).toEqual([]);
  });
});
