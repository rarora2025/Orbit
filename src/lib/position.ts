// Minimal shape the ordering math needs — works with any contact-like record
// that carries an id, a board status, and a numeric position. Kept structural so
// both the app's Contact and test fixtures satisfy it without a shared type.
interface Positioned {
  id: string;
  status: string;
  position: number;
}

const STEP = 1000;

/** Position for a new card appended to the end of its column. */
export function appendPosition<T extends Positioned>(contacts: T[], status: string): number {
  const inColumn = contacts.filter(c => c.status === status);
  if (inColumn.length === 0) return STEP;
  return inColumn.reduce((m, c) => Math.max(m, c.position), 0) + STEP;
}

/**
 * Position that places `movingId` immediately before `beforeId` within
 * `status`. When `beforeId` is null or not found, the card is appended to the
 * end of the column.
 */
export function positionBefore<T extends Positioned>(
  contacts: T[],
  status: string,
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
  // Fractional indexing: midpoint between neighbours. Gaps shrink with each
  // successive insert at the same spot; at CRM column sizes this is safe.
  return (prev + next) / 2;
}

/** Ascending order by `position` (column grouping is the caller's job). */
export function sortByPosition<T extends Positioned>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => a.position - b.position);
}
