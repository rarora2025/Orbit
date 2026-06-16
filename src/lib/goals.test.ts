import { describe, it, expect } from 'vitest';
import { goalImagePrompt, toggleMember } from './goals';

describe('goalImagePrompt', () => {
  it('embeds the title in a tasteful default style prompt', () => {
    const p = goalImagePrompt('Break into VC');
    expect(p).toContain('Break into VC');
    expect(p.toLowerCase()).toContain('illustration');
  });

  it('trims surrounding whitespace from the title', () => {
    expect(goalImagePrompt('  Recruiting  ')).toContain('"Recruiting"');
  });
});

describe('toggleMember', () => {
  it('adds an absent id', () => {
    expect(toggleMember(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('removes a present id', () => {
    expect(toggleMember(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('does not mutate the input array', () => {
    const input = ['a'];
    toggleMember(input, 'b');
    expect(input).toEqual(['a']);
  });
});
