import { describe, it, expect } from 'vitest';
import { generateDraftMessage, type Tone, type Channel } from './draftMessage';
import type { Contact } from './mockData';

function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    id: 'a', position: 1000, name: 'Vinit Shah', company: 'Mojo', role: 'Founder',
    linkedinUrl: '', email: '', context: '', status: 'Send',
    score: 50, warmth: 'Medium', avatarColor: '', tags: [], lastContacted: '', nextAction: '',
    aiSummary: '', outreachAngle: '', suggestedMessage: '', interactions: [],
    ...over,
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
  it('incorporates the person context when present', () => {
    const msg = generateDraftMessage(makeContact({ context: 'building a prediction market exchange' }), 'Casual', 'Email');
    expect(msg).toContain('building a prediction market exchange');
  });
  it('never references the relationship goal', () => {
    const msg = generateDraftMessage(makeContact({ goal: 'raise a seed round', context: '' }), 'Casual', 'Email');
    expect(msg).not.toContain('raise a seed round');
  });
  it('falls back to a sensible greeting for an empty name', () => {
    expect(generateDraftMessage(makeContact({ name: '' }), 'Short', 'Text')).toContain('there');
  });
});
