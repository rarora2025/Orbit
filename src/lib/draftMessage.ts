import type { Contact } from './mockData';

export type Tone = 'Short' | 'Casual' | 'Professional';
export type Channel = 'Email' | 'LinkedIn' | 'Text';

export const TONES: Tone[] = ['Short', 'Casual', 'Professional'];
export const CHANNELS: Channel[] = ['Email', 'LinkedIn', 'Text'];

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

/** A specific, bracket-free reason to connect, drawn from the contact's fields.
 *  Goals are deliberately NOT used — messages should never reference them. */
function reason(contact: Contact): string {
  const context = contact.context?.trim();
  if (context) return context;
  if (contact.role && contact.company) return `your work as ${contact.role} at ${contact.company}`;
  if (contact.company) return `your work at ${contact.company}`;
  if (contact.role) return `your work as ${contact.role}`;
  return 'your work';
}

/**
 * Deterministic outreach draft used as the instant fallback before the OpenAI
 * draft lands (and kept if OpenAI is unavailable). Pure — no network, no random.
 */
export function generateDraftMessage(contact: Contact, tone: Tone, channel: Channel): string {
  const name = firstName(contact.name);
  const r = reason(contact);
  const greeting = channel === 'Text' ? `Hey ${name}` : `Hi ${name}`;
  const closer = channel === 'Email' ? '\n\nBest' : '';

  if (tone === 'Short') {
    return `${greeting} — really admire ${r}. Would love to connect.${closer}`;
  }
  if (tone === 'Professional') {
    return `${greeting},\n\nI've been following ${r} and would welcome the chance to connect. I'd value your perspective and am happy to find a time that works for you.${closer}`;
  }
  return `${greeting}! I came across ${r} and thought it was genuinely interesting — would love to connect sometime.${closer}`;
}
