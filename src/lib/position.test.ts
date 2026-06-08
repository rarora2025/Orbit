import { describe, it, expect } from 'vitest';
import { appendPosition, positionBefore, sortByPosition } from './position';
import type { Contact } from './contact';

function c(id: string, status: Contact['status'], position: number): Contact {
  return { id, name: id, company: '', status, score: 0, temperature: 'Medium', tags: [], position };
}

describe('position helpers', () => {
  it('appendPosition starts a fresh column at STEP', () => {
    expect(appendPosition([], 'Send')).toBe(1000);
  });

  it('appendPosition goes after the last card in the column', () => {
    const list = [c('a', 'Send', 1000), c('b', 'Send', 2000), c('x', 'Pending', 5000)];
    expect(appendPosition(list, 'Send')).toBe(3000);
  });

  it('positionBefore lands between neighbours', () => {
    const list = [c('a', 'Send', 1000), c('b', 'Send', 2000)];
    expect(positionBefore(list, 'Send', 'b', 'moving')).toBe(1500);
  });

  it('positionBefore at the head of a column halves the first position', () => {
    const list = [c('a', 'Send', 1000)];
    expect(positionBefore(list, 'Send', 'a', 'moving')).toBe(500);
  });

  it('positionBefore with null target appends to the column end', () => {
    const list = [c('a', 'Send', 1000)];
    expect(positionBefore(list, 'Send', null, 'moving')).toBe(2000);
  });

  it('sortByPosition orders ascending', () => {
    const sorted = sortByPosition([c('b', 'Send', 2000), c('a', 'Send', 1000)]);
    expect(sorted.map(x => x.id)).toEqual(['a', 'b']);
  });
});
