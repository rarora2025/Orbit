import type { Contact, Status } from './contact';

const STEP = 1000;

/** Position for a new card appended to the end of its column. */
export function appendPosition(contacts: Contact[], status: Status): number {
  const inColumn = contacts.filter(c => c.status === status);
  if (inColumn.length === 0) return STEP;
  return Math.max(...inColumn.map(c => c.position)) + STEP;
}

/**
 * Position that places `movingId` immediately before `beforeId` within
 * `status`. When `beforeId` is null or not found, the card is appended to the
 * end of the column.
 */
export function positionBefore(
  contacts: Contact[],
  status: Status,
  beforeId: string | null,
  movingId: string,
): number {
  const column = contacts
    .filter(c => c.status === status && c.id !== movingId)
    .sort((a, b) => a.position - b.position);

  if (!beforeId) {
    return column.length === 0 ? STEP : column[column.length - 1].position + STEP;
  }
  const idx = column.findIndex(c => c.id === beforeId);
  if (idx === -1) {
    return column.length === 0 ? STEP : column[column.length - 1].position + STEP;
  }
  const prev = idx === 0 ? 0 : column[idx - 1].position;
  const next = column[idx].position;
  return (prev + next) / 2;
}

/** Ascending order by `position` (column grouping is the caller's job). */
export function sortByPosition(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => a.position - b.position);
}
