import { describe, it, expect } from 'vitest';
import { tokenizeInline, parseBlocks } from './markdown';

describe('tokenizeInline', () => {
  it('parses bold, italic, and code', () => {
    expect(tokenizeInline('Talk to **Sarah** now')).toEqual([
      { type: 'text', value: 'Talk to ' },
      { type: 'bold', value: 'Sarah' },
      { type: 'text', value: ' now' },
    ]);
    expect(tokenizeInline('_emphasis_')).toEqual([{ type: 'italic', value: 'emphasis' }]);
    expect(tokenizeInline('run `npm test`')).toEqual([
      { type: 'text', value: 'run ' },
      { type: 'code', value: 'npm test' },
    ]);
  });

  it('leaves plain text alone', () => {
    expect(tokenizeInline('just words')).toEqual([{ type: 'text', value: 'just words' }]);
  });
});

describe('parseBlocks', () => {
  it('groups consecutive bullets into one list', () => {
    const blocks = parseBlocks('Here:\n- Sarah\n- Marcus');
    expect(blocks).toEqual([
      { type: 'p', lines: ['Here:'] },
      { type: 'ul', items: ['Sarah', 'Marcus'] },
    ]);
  });

  it('handles numbered lists', () => {
    expect(parseBlocks('1. First\n2. Second')).toEqual([{ type: 'ol', items: ['First', 'Second'] }]);
  });
});
