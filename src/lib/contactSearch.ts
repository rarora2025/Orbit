import type { Contact } from './mockData';

// Fields a search query is matched against. Intentionally limited to the
// identifying attributes you'd look someone up by — free-text fields like
// `inquiry` / `context` are out of scope (see the pipeline-search design doc).
function searchableText(contact: Contact): string {
  return [contact.name, contact.company, contact.role, ...contact.tags]
    .join(' ')
    .toLowerCase();
}

/**
 * Narrow a contact list to those matching `query` (case-insensitive substring
 * across name, company, role and tags). An empty/whitespace query returns the
 * original array reference unchanged, so callers can treat "no query" as "no
 * filtering" without copying.
 */
export function filterContacts(contacts: Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (q === '') return contacts;
  return contacts.filter(c => searchableText(c).includes(q));
}
