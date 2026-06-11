import { describe, it, expect } from 'vitest';
import { formatReadableDate, formatTime, formatMeetingWhen, formatMeetingSummary, formatFollowUpAt } from './meeting';

describe('formatReadableDate', () => {
  it('formats an ISO date as month + day, free of timezone drift', () => {
    expect(formatReadableDate('2026-06-18')).toBe('June 18');
    expect(formatReadableDate('2026-01-01')).toBe('January 1');
  });
  it('returns an empty string for missing/blank input', () => {
    expect(formatReadableDate('')).toBe('');
  });
});

describe('formatTime', () => {
  it('converts 24h time to a 12h clock with period', () => {
    expect(formatTime('14:00')).toBe('2:00 PM');
    expect(formatTime('09:05')).toBe('9:05 AM');
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('23:30')).toBe('11:30 PM');
  });
  it('returns an empty string for missing input', () => {
    expect(formatTime('')).toBe('');
  });
});

describe('formatMeetingWhen', () => {
  it('joins date and time', () => {
    expect(formatMeetingWhen('2026-06-18', '14:00')).toBe('June 18 at 2:00 PM');
  });
  it('falls back to date alone when time is missing', () => {
    expect(formatMeetingWhen('2026-06-18', '')).toBe('June 18');
  });
});

describe('formatMeetingSummary', () => {
  it('includes notes when present', () => {
    expect(formatMeetingSummary('2026-06-18', '14:00', 'Talk about DraftIQ partnerships')).toBe(
      'Meeting scheduled for June 18 at 2:00 PM. Notes: Talk about DraftIQ partnerships',
    );
  });
  it('omits the notes clause when blank', () => {
    expect(formatMeetingSummary('2026-06-18', '14:00', '   ')).toBe('Meeting scheduled for June 18 at 2:00 PM.');
  });
});

describe('formatFollowUpAt', () => {
  it('builds an ISO timestamp anchored at local noon to avoid day shift', () => {
    const iso = formatFollowUpAt('2026-06-18');
    expect(new Date(iso).getFullYear()).toBe(2026);
    expect(formatReadableDate(iso.slice(0, 10))).toBe('June 18');
  });
});
