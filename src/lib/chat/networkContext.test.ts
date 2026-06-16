import { describe, it, expect } from 'vitest';
import { buildNetworkSnapshot } from './networkContext';
import type { Contact } from '../mockData';
import type { Goal } from '../goals';

function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    id: over.id ?? crypto.randomUUID(),
    position: 1,
    name: 'Sarah Chen',
    company: 'Anthropic',
    role: 'Research Lead',
    linkedinUrl: '',
    email: '',
    notes: '',
    status: 'Pending',
    score: 50,
    warmth: 'High',
    avatarColor: '',
    tags: ['AI', 'Research'],
    lastContacted: '2026-06-02T00:00:00.000Z',
    nextAction: '',
    aiSummary: '',
    outreachAngle: '',
    suggestedMessage: '',
    interactions: [],
    ...over,
  };
}

function makeGoal(over: Partial<Goal> = {}): Goal {
  return {
    id: crypto.randomUUID(),
    title: 'Fundraising',
    imageUrl: null,
    memberIds: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

describe('buildNetworkSnapshot', () => {
  it('reports empty network', () => {
    const out = buildNetworkSnapshot([], []);
    expect(out).toContain('People (0):');
    expect(out).toContain('No contacts yet.');
    expect(out).toContain('Goals (0):');
    expect(out).toContain('No goals yet.');
  });

  it('renders a contact line with the key fields', () => {
    const out = buildNetworkSnapshot([makeContact({ goal: 'Fundraising' })], []);
    expect(out).toContain('Sarah Chen — Research Lead at Anthropic');
    expect(out).toContain('Pending');
    expect(out).toContain('High');
    expect(out).toContain('tags: AI, Research');
    expect(out).toContain('goal: Fundraising');
    expect(out).toContain('last activity Jun 2, 2026');
  });

  it('renders goals with membership counts', () => {
    const goals = [makeGoal({ title: 'Hiring', memberIds: ['a', 'b'] }), makeGoal({ title: 'Solo' })];
    const out = buildNetworkSnapshot([], goals);
    expect(out).toContain('Goals (2):');
    expect(out).toContain('- Hiring · 2 people');
    expect(out).toContain('- Solo');
    expect(out).not.toContain('Solo · ');
  });

  it('truncates very large networks', () => {
    const many = Array.from({ length: 175 }, (_, i) => makeContact({ id: String(i), name: `P${i}` }));
    const out = buildNetworkSnapshot(many, []);
    expect(out).toContain('People (175):');
    expect(out).toContain('…and 25 more.');
  });
});
