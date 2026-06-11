/**
 * Pure formatting helpers for the Schedule Meeting / follow-up workflows.
 *
 * The simplified schema has no dedicated meeting/date columns, so the date and
 * time a user picks are baked into human-readable interaction `content` text.
 * These helpers keep that formatting in one tested place. Dates are parsed from
 * their `YYYY-MM-DD` parts (not `new Date(str)`) so a UTC-midnight parse can't
 * shift the day backwards in negative-offset timezones.
 */

/** "2026-06-18" -> "June 18". Empty input yields an empty string. */
export function formatReadableDate(date: string): string {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

/** "14:00" -> "2:00 PM". Empty input yields an empty string. */
export function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "June 18 at 2:00 PM", or just the date when no time was given. */
export function formatMeetingWhen(date: string, time: string): string {
  const when = formatReadableDate(date);
  const at = formatTime(time);
  return at ? `${when} at ${at}` : when;
}

/** The interaction content stored for a scheduled meeting. */
export function formatMeetingSummary(date: string, time: string, notes: string): string {
  const base = `Meeting scheduled for ${formatMeetingWhen(date, time)}.`;
  const trimmed = notes.trim();
  return trimmed ? `${base} Notes: ${trimmed}` : base;
}

/**
 * Turn a date-only picker value ("2026-06-18") into a stored ISO timestamp,
 * anchored at local noon so it renders as the same calendar day everywhere.
 */
export function formatFollowUpAt(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}
