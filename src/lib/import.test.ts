import { describe, it, expect } from 'vitest';
import { parseContactLines, toImportRow, normalizeStatus, normalizeWarmth } from './import';

describe('parseContactLines', () => {
  it('parses name, company, email, phone in order', () => {
    expect(parseContactLines('Jane Chen, Acme, jane@acme.com, 202 555 0198')).toEqual([
      { name: 'Jane Chen', company: 'Acme', email: 'jane@acme.com', phone: '202 555 0198' },
    ]);
  });

  it('classifies fields regardless of order after the name', () => {
    expect(parseContactLines('Bob Lee; bob@x.io; +1 (415) 555-2020; Initech')).toEqual([
      { name: 'Bob Lee', email: 'bob@x.io', phone: '+1 (415) 555-2020', company: 'Initech' },
    ]);
  });

  it('drops a header row and blank lines', () => {
    const rows = parseContactLines('Name, Company\n\nAda Lovelace, Analytical');
    expect(rows).toEqual([{ name: 'Ada Lovelace', company: 'Analytical' }]);
  });
});

describe('toImportRow', () => {
  it('trims and keeps only non-empty fields', () => {
    expect(toImportRow({ name: '  Grace Hopper ', company: ' Navy ', email: '', phone: undefined }))
      .toEqual({ name: 'Grace Hopper', company: 'Navy' });
  });

  it('returns null without a usable name', () => {
    expect(toImportRow({ company: 'Acme' })).toBeNull();
    expect(toImportRow({ name: 'name' })).toBeNull();
    expect(toImportRow('nope')).toBeNull();
  });

  it('carries pipeline fields from a CRM-style export', () => {
    expect(toImportRow({ name: 'Shayne Coplan', company: 'Polymarket', status: 'Pending', temp: '***' }))
      .toEqual({ name: 'Shayne Coplan', company: 'Polymarket', status: 'Pending', warmth: 'High' });
  });

  it('keeps non-empty tags and drops an unrecognized status', () => {
    expect(toImportRow({ name: 'Daniel Jeong', status: 'Unknown', tags: ['Networking', ''] }))
      .toEqual({ name: 'Daniel Jeong', tags: ['Networking'] });
  });
});

describe('normalizeStatus', () => {
  it('matches board statuses case-insensitively', () => {
    expect(normalizeStatus('pending')).toBe('Pending');
    expect(normalizeStatus('GHOSTED')).toBe('Ghosted');
    expect(normalizeStatus('Long-term')).toBe('Long-term');
  });
  it('returns undefined for unknown values', () => {
    expect(normalizeStatus('Series')).toBeUndefined();
    expect(normalizeStatus(42)).toBeUndefined();
  });
});

describe('normalizeWarmth', () => {
  it('maps star ratings to Low/Medium/High', () => {
    expect(normalizeWarmth('*')).toBe('Low');
    expect(normalizeWarmth('**')).toBe('Medium');
    expect(normalizeWarmth('***')).toBe('High');
  });
  it('accepts words and numbers', () => {
    expect(normalizeWarmth('high')).toBe('High');
    expect(normalizeWarmth(2)).toBe('Medium');
    expect(normalizeWarmth('')).toBeUndefined();
  });
});
