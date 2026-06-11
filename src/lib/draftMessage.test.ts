import { describe, it, expect } from 'vitest';
import { generateDraftMessage, type Tone, type Channel } from './draftMessage';
import type { Contact } from './mockData';

function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    id: 'a', position: 1000, name: 'Vinit Shah', company: 'Mojo', role: 'Founder',
    linkedinUrl: '', email: '', inquiry: '', notes: '', status: 'Send', priority: 'Medium',
    score: 50, warmth: 'Medium', avatarColor: '', tags: [], lastContacted: '', nextAction: '',
    aiSummary: '', outreachAngle: '', suggestedMessage: '', interactions: [],
    relationshipGoal: 'learn about sports betting products', ...over,
  };
}

describe('generateDraftMessage', () => {
  it('greets the contact by first name', () => {
    expect(generateDraftMessage(makeContact(), 'Casual', 'Email')).toContain('Vinit');
  });
  it('never leaves placeholder brackets', () => {
    for (const tone of ['Short', 'Casual', 'Professional'] as Tone[]) {
      for (const channel of ['Email', 'LinkedIn', 'Text'] as Channel[]) {
        expect(generateDraftMessage(makeContact(), tone, channel)).not.toMatch(/[[\]]/);
      }
    }
  });
  it('varies output by tone', () => {
    const short = generateDraftMessage(makeContact(), 'Short', 'Email');
    const pro = generateDraftMessage(makeContact(), 'Professional', 'Email');
    expect(short).not.toBe(pro);
  });
  it('incorporates the relationship goal when present', () => {
    const msg = generateDraftMessage(makeContact({ relationshipGoal: 'sports betting products' }), 'Casual', 'Email');
    expect(msg).toContain('sports betting products');
  });
  it('falls back to a sensible greeting for an empty name', () => {
    expect(generateDraftMessage(makeContact({ name: '' }), 'Short', 'Text')).toContain('there');
  });
});
