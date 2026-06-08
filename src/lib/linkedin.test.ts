import { describe, it, expect } from 'vitest';
import { deriveNameFromLinkedInUrl, resolveAutoName } from './linkedin';

describe('deriveNameFromLinkedInUrl', () => {
  it('parses a standard /in/ slug', () => {
    expect(deriveNameFromLinkedInUrl('https://linkedin.com/in/shayne-coplan')).toBe('Shayne Coplan');
  });
  it('handles www, trailing slash and query string', () => {
    expect(deriveNameFromLinkedInUrl('https://www.linkedin.com/in/jay-deuskar/?originalSubdomain=us')).toBe('Jay Deuskar');
  });
  it('supports /pub/ paths', () => {
    expect(deriveNameFromLinkedInUrl('https://linkedin.com/pub/ali-hirsa')).toBe('Ali Hirsa');
  });
  it('drops a trailing numeric id token', () => {
    expect(deriveNameFromLinkedInUrl('https://linkedin.com/in/john-smith-12345678')).toBe('John Smith');
  });
  it('drops a trailing alphanumeric id token', () => {
    expect(deriveNameFromLinkedInUrl('https://linkedin.com/in/jane-doe-a1b2c3')).toBe('Jane Doe');
  });
  it('returns empty for non-LinkedIn or empty input', () => {
    expect(deriveNameFromLinkedInUrl('')).toBe('');
    expect(deriveNameFromLinkedInUrl('https://example.com/in/whoever')).toBe('');
  });
});

describe('resolveAutoName', () => {
  it('fills the name when current is empty', () => {
    expect(resolveAutoName('', 'https://linkedin.com/in/shayne-coplan')).toBe('Shayne Coplan');
  });
  it('never overwrites a name the user typed', () => {
    expect(resolveAutoName('Custom Name', 'https://linkedin.com/in/shayne-coplan')).toBe('Custom Name');
  });
  it('leaves blank when current empty and url unparseable', () => {
    expect(resolveAutoName('', 'not a url')).toBe('');
  });
});
