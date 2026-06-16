import { describe, it, expect } from 'vitest';
import { goalImagePrompt, toggleMember } from './goals';

describe('goalImagePrompt', () => {
  it('embeds the title in a tasteful default style prompt', () => {
    expect(goalImagePrompt('Break into VC')).toBe(
      '"Break into VC", minimal modern editorial illustration, soft warm palette, abstract, no text',
    );
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
