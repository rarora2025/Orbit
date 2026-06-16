import type { Contact } from '../mockData';

export type ResolveResult =
  | { contact: Contact }
  | { error: string; ambiguous?: boolean };

/**
 * Best-effort match of a name the model used to a real contact. Tries, in order:
 * exact full name, "name at company", unique first name, unique substring. Returns
 * a typed error (with `ambiguous` when several match) so the caller can ask the
 * user to disambiguate rather than acting on the wrong person.
 */
export function resolveContact(name: string, contacts: Contact[]): ResolveResult {
  const q = name.trim().toLowerCase();
  if (!q) return { error: 'No name was given.' };

  const exact = contacts.filter((c) => c.name.toLowerCase() === q);
  if (exact.length === 1) return { contact: exact[0] };
  if (exact.length > 1) return { error: `There are ${exact.length} people named ${name}.`, ambiguous: true };

  const at = q.match(/^(.+?)\s+(?:at|from|@)\s+(.+)$/);
  if (at) {
    const nm = at[1].trim();
    const co = at[2].trim();
    const byCo = contacts.filter(
      (c) => c.name.toLowerCase().includes(nm) && c.company.toLowerCase().includes(co),
    );
    if (byCo.length === 1) return { contact: byCo[0] };
  }

  const first = contacts.filter((c) => c.name.toLowerCase().split(/\s+/)[0] === q);
  if (first.length === 1) return { contact: first[0] };
  if (first.length > 1) return { error: `Several people go by ${name}.`, ambiguous: true };

  const contains = contacts.filter((c) => c.name.toLowerCase().includes(q));
  if (contains.length === 1) return { contact: contains[0] };
  if (contains.length > 1) return { error: `“${name}” matches several people.`, ambiguous: true };

  return { error: `I couldn't find ${name} in your network.` };
}
