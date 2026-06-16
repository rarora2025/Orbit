import { describe, it, expect } from 'vitest';
import { resolveContact } from './resolveContact';
import type { Contact } from '../mockData';

function c(name: string, company = ''): Contact {
  return {
    id: name, position: 1, name, company, role: '', linkedinUrl: '', email: '', notes: '',
    status: 'Send', score: 50, warmth: 'Medium', avatarColor: '', tags: [],
    lastContacted: '', nextAction: '', aiSummary: '', outreachAngle: '', suggestedMessage: '', interactions: [],
  };
}

const people = [c('Sarah Chen', 'Anthropic'), c('Marcus Lee', 'OpenAI'), c('Sarah Kim', 'Stripe')];

describe('resolveContact', () => {
  it('matches an exact full name', () => {
    expect(resolveContact('Marcus Lee', people)).toEqual({ contact: people[1] });
  });

  it('matches a unique first name', () => {
    expect(resolveContact('Marcus', people)).toEqual({ contact: people[1] });
  });

  it('disambiguates a shared first name via "at company"', () => {
    expect(resolveContact('Sarah at Stripe', people)).toEqual({ contact: people[2] });
  });

  it('flags an ambiguous first name', () => {
    const r = resolveContact('Sarah', people);
    expect('error' in r && r.ambiguous).toBe(true);
  });

  it('errors when not found', () => {
    const r = resolveContact('Nobody', people);
    expect('error' in r && !r.ambiguous).toBe(true);
  });
});
