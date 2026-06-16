import { describe, it, expect } from 'vitest';
import { goalImagePrompt } from './goals';

describe('goalImagePrompt', () => {
  it('embeds the title in a tasteful default style prompt', () => {
    expect(goalImagePrompt('Break into VC')).toBe(
      '"Break into VC", minimal modern editorial illustration, soft warm palette, abstract, no text',
    );
  });

  it('trims surrounding whitespace from the title', () => {
    expect(goalImagePrompt('  Recruiting  ')).toContain('"Recruiting"');
  });

  it('strips embedded quotes and newlines so the title cannot break out', () => {
    expect(goalImagePrompt('Evil "x"\nbreak')).toBe(
      '"Evil x break", minimal modern editorial illustration, soft warm palette, abstract, no text',
    );
  });
});
