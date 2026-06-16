import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './prompt';

describe('buildSystemPrompt', () => {
  const base = { snapshot: 'People (1):\n- Sarah Chen', memory: '', today: '2026-06-16' };

  it('embeds the snapshot and the confirm rule', () => {
    const p = buildSystemPrompt({ ...base, userName: 'Rahul' });
    expect(p).toContain('Sarah Chen');
    expect(p).toContain('PROPOSAL');
    expect(p).toContain('Rahul');
    expect(p).toContain('2026-06-16');
  });

  it('includes memory when present and notes its absence otherwise', () => {
    expect(buildSystemPrompt({ ...base, memory: 'Designer raising a pre-seed.' })).toContain('Designer raising a pre-seed.');
    expect(buildSystemPrompt(base)).toContain('no saved profile');
  });
});
