import { describe, it, expect } from 'vitest';
import { createNdjsonParser } from './ndjson';

describe('createNdjsonParser', () => {
  it('parses whole lines', () => {
    const p = createNdjsonParser();
    expect(p.push('{"type":"text","delta":"hi"}\n')).toEqual([{ type: 'text', delta: 'hi' }]);
  });

  it('buffers partial lines across chunk boundaries', () => {
    const p = createNdjsonParser();
    expect(p.push('{"type":"text",')).toEqual([]);
    expect(p.push('"delta":"yo"}\n{"type":"done"}\n')).toEqual([
      { type: 'text', delta: 'yo' },
      { type: 'done' },
    ]);
  });

  it('ignores blank lines and flushes the trailing line', () => {
    const p = createNdjsonParser();
    expect(p.push('\n\n{"type":"done"}')).toEqual([]);
    expect(p.flush()).toEqual([{ type: 'done' }]);
  });

  it('skips malformed lines without throwing', () => {
    const p = createNdjsonParser();
    expect(p.push('not json\n{"type":"done"}\n')).toEqual([{ type: 'done' }]);
  });
});
