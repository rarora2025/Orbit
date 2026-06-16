import { describe, it, expect } from 'vitest';
import { statusFromChange } from './mockData';

describe('statusFromChange', () => {
  it('reads the destination from "Moved to X" text', () => {
    expect(statusFromChange('Moved to Response')).toBe('Response');
  });
  it('handles the ghosted phrasing', () => {
    expect(statusFromChange('Marked as ghosted')).toBe('Ghosted');
  });
  it('handles the long-term phrasing', () => {
    expect(statusFromChange('Moved to long-term')).toBe('Long-term');
  });
  it('prefers the longer status name (Meeting Scheduled, not Met)', () => {
    expect(statusFromChange('Moved to Meeting Scheduled')).toBe('Meeting Scheduled');
  });
  it('returns null for unrelated text', () => {
    expect(statusFromChange('Logged a note')).toBeNull();
  });
});
