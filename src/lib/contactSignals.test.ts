import { describe, it, expect } from 'vitest';
import { generateContactSignals } from './contactSignals';

describe('generateContactSignals', () => {
  it('returns neutral placeholder signals (stub for the future LLM)', () => {
    const s = generateContactSignals('Ada Lovelace', 'Analytical Engines');
    expect(s.score).toBe(50);
    expect(s.temperature).toBe('Medium');
    expect(s.tags).toEqual([]);
  });

  it('produces values in the contract ranges', () => {
    const s = generateContactSignals('', '');
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.tags.length).toBeLessThanOrEqual(2);
  });
});
