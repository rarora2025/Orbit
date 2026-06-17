'use server';

import OpenAI from 'openai';
import { currentUser } from '@clerk/nextjs/server';
import { listContacts } from './contacts.actions';
import type { Contact } from './mockData';
import type { MoveKind } from './nextMoves';
import type { Tone, Channel } from './draftMessage';

// Easy to bump as your account gets access to newer models.
const MODEL = 'gpt-4o-mini';

// What each kind of move should produce. Falls back to a generic message.
const KIND_INTENT: Record<string, string> = {
  'follow-up': 'a warm, brief follow-up that nudges them for a reply without guilt-tripping',
  'reply': 'a reply that keeps the conversation moving, ideally toward a short call',
  'outreach': 'a first outreach that introduces me and gives a clear, specific reason to connect',
  'message': 'a concise, friendly message',
};

function openaiClient(): OpenAI | null {
  const apiKey = process.env.OPEN_AI_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

async function fetchContact(id: string): Promise<Contact | null> {
  // Reuse the canonical read so interactions are joined from the table (the
  // blob no longer carries them) and field back-compat is applied.
  const contacts = await listContacts();
  return contacts.find((c) => c.id === id) ?? null;
}

/**
 * Generate a tailored draft message for a contact using OpenAI. Throws if the
 * key is missing, the contact can't be found, or the API errors — callers are
 * expected to fall back to their local heuristic draft so the UI never breaks.
 */
export async function generateDraft(
  contactId: string,
  kind: MoveKind | 'message' = 'message',
  tone?: Tone,
  channel?: Channel,
): Promise<string> {
  const openai = openaiClient();
  if (!openai) throw new Error('OPEN_AI_KEY not configured');

  const contact = await fetchContact(contactId);
  if (!contact) throw new Error('Contact not found');

  const me = await currentUser();
  const myName = me?.firstName || me?.fullName || '';

  const intent = KIND_INTENT[kind] ?? KIND_INTENT.message;
  const lastNote = contact.interactions.at(-1)?.content ?? '';
  const context = contact.context?.trim();
  const userPrompt = [
    `Write ${intent} to ${contact.name}${contact.role ? `, ${contact.role}` : ''}${contact.company ? ` at ${contact.company}` : ''}.`,
    channel ? `It will be sent via ${channel}, so match that medium's length and formality.` : '',
    tone ? `Tone: ${tone}.` : '',
    myName ? `The message is from me, ${myName} — sign it off with my name.` : '',
    // Ground the message in what the user actually knows about this person.
    context
      ? `What I know about ${contact.name}: "${context}". Ground the message specifically in this — reference something concrete from it rather than writing something generic.`
      : `I don't have specific notes on ${contact.name} yet, so keep it short and genuine and do NOT invent specifics about them or their work.`,
    contact.tags.length ? `Relevant context tags: ${contact.tags.join(', ')}.` : '',
    lastNote ? `Most recent interaction: "${lastNote}".` : '',
    'Keep it under 120 words, natural and specific. Never reference my goals or agenda. Never use placeholders such as [Name], [Your name], or [Company]. Return only the message body.',
  ].filter(Boolean).join('\n');

  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `You are a concise, friendly networking assistant. You write outreach in the first person, as the user${myName ? ` (${myName})` : ''}. Never leave placeholder brackets in the message.`,
      },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty completion');
  return text;
}
