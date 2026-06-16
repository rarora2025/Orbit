import type { Contact } from '../mockData';
import type { Goal } from '../goals';

const MAX_CONTACTS = 150;

/** Short, human-readable date (or '' when missing/invalid). */
function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** One compact line describing a contact for the model. */
function contactLine(c: Contact): string {
  const parts = [c.name];
  const roleCo = [c.role, c.company].filter(Boolean).join(' at ');
  if (roleCo) parts.push(roleCo);
  const meta: string[] = [c.status, c.warmth];
  if (c.tags.length) meta.push(`tags: ${c.tags.join(', ')}`);
  if (c.goal) meta.push(`goal: ${c.goal}`);
  const last = shortDate(c.lastContacted);
  if (last) meta.push(`last activity ${last}`);
  return `- ${parts.join(' — ')} · ${meta.join(' · ')}`;
}

/**
 * Render the signed-in user's whole network into a compact text block for the
 * system prompt. Cheap and complete — at personal-CRM scale the model reasons
 * better seeing everything than guessing what to retrieve. Caps the contact
 * list so a very large network can't blow the context window.
 */
export function buildNetworkSnapshot(contacts: Contact[], goals: Goal[]): string {
  const peopleHeader = `People (${contacts.length}):`;
  const shown = contacts.slice(0, MAX_CONTACTS);
  const peopleBody = contacts.length === 0
    ? 'No contacts yet.'
    : shown.map(contactLine).join('\n') +
      (contacts.length > MAX_CONTACTS ? `\n…and ${contacts.length - MAX_CONTACTS} more.` : '');

  const goalsHeader = `Goals (${goals.length}):`;
  const goalsBody = goals.length === 0
    ? 'No goals yet.'
    : goals
        .map((g) => {
          const n = g.memberIds.length;
          return `- ${g.title}${n ? ` · ${n} ${n === 1 ? 'person' : 'people'}` : ''}`;
        })
        .join('\n');

  return `${peopleHeader}\n${peopleBody}\n\n${goalsHeader}\n${goalsBody}`;
}
