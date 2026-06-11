'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import type { Contact, Status, Interaction } from './mockData';
import { appendPosition, positionBefore } from './position';
import { formatMeetingSummary, formatFollowUpAt, formatReadableDate } from './meeting';

interface Row {
  id: string;
  position: number;
  data: Contact;
}

function rowToContact(r: Row): Contact {
  // The full contact lives in `data`; id/position are authoritative columns.
  return { ...r.data, id: r.id, position: r.position };
}

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export async function listContacts(): Promise<Contact[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('id, position, data')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(rowToContact);
}

export async function addContact(contact: Contact): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const position = appendPosition(existing, contact.status);
  const stored: Contact = { ...contact, position };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({ id: stored.id, user_id: userId, position, data: stored })
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find((c) => c.id === id);
  if (!current) throw new Error('Contact not found');
  const merged: Contact = { ...current, ...updates, id, position: current.position };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

export async function moveContact(id: string, toStatus: Status, beforeId: string | null): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find((c) => c.id === id);
  if (!current) throw new Error('Contact not found');
  const position = positionBefore(existing, toStatus, beforeId, id);
  const merged: Contact = { ...current, status: toStatus, position };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ position, data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

export async function deleteContact(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

export interface InteractionInput {
  channel: string;
  content: string;
}

function buildInteraction(type: Interaction['type'], input: InteractionInput, at: Date): Interaction {
  return {
    id: crypto.randomUUID(),
    date: at.toISOString(),
    type,
    channel: input.channel,
    content: input.content,
  };
}

/** Append a "message_drafted" interaction. Does NOT change status. */
export async function addDraftInteraction(contactId: string, input: InteractionInput): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find((c) => c.id === contactId);
  if (!current) throw new Error('Contact not found');
  const interaction = buildInteraction('message_drafted', input, new Date());
  const merged: Contact = { ...current, interactions: [...current.interactions, interaction] };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', contactId)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

/**
 * Append "message_sent" + "follow_up_scheduled" interactions and advance the
 * contact: status -> Pending, lastContacted = now, nextFollowUpAt = now + 7 days.
 */
export async function markMessageSent(contactId: string, input: InteractionInput): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find((c) => c.id === contactId);
  if (!current) throw new Error('Contact not found');

  const now = new Date();
  const sent = buildInteraction('message_sent', input, now);
  const followUp = buildInteraction(
    'follow_up_scheduled',
    { channel: input.channel, content: 'Follow up if no response in 7 days' },
    new Date(now.getTime() + 1), // 1ms later so it sorts just after the sent entry
  );
  const nextFollowUpAt = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const merged: Contact = {
    ...current,
    status: 'Pending',
    lastContacted: now.toISOString(),
    nextFollowUpAt,
    interactions: [...current.interactions, sent, followUp],
  };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', contactId)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

// --- Shared helpers for the lifecycle workflows below -----------------------

/** Load the current contact, scoped to the signed-in user. */
async function requireContact(contactId: string): Promise<{ userId: string; current: Contact }> {
  const userId = await requireUserId();
  const current = (await listContacts()).find((c) => c.id === contactId);
  if (!current) throw new Error('Contact not found');
  return { userId, current };
}

/** Persist a merged contact's `data` blob, scoped to user + id. */
async function persist(userId: string, contactId: string, merged: Contact): Promise<Contact> {
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', contactId)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

/** A channel-less interaction (meeting/note/status events have no channel). */
function newInteraction(type: Interaction['type'], content: string, at: Date = new Date()): Interaction {
  return { id: crypto.randomUUID(), date: at.toISOString(), type, content };
}

export interface ResponseInput {
  /** Free-text summary of the reply. */
  content: string;
  /** Optional captured next step (e.g. "Schedule meeting"); appended to content. */
  nextStep?: string;
}

/**
 * Append a "response_logged" interaction and advance the contact: status ->
 * Response, nextFollowUpAt cleared. The channel is preserved from the contact's
 * most recent interaction when available. Status does not branch on next step.
 */
export async function logResponse(contactId: string, input: ResponseInput): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find((c) => c.id === contactId);
  if (!current) throw new Error('Contact not found');

  const interaction: Interaction = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    type: 'response_logged',
    channel: current.interactions.at(-1)?.channel,
    content: input.content.trim(),
    nextStep: input.nextStep,
  };

  const merged: Contact = {
    ...current,
    status: 'Response',
    nextFollowUpAt: undefined, // clear the pending follow-up; dropped on serialization
    interactions: [...current.interactions, interaction],
  };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', contactId)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

export interface MeetingInput {
  /** "YYYY-MM-DD" from a date picker. */
  date: string;
  /** "HH:MM" (24h) from a time picker; may be blank. */
  time: string;
  notes: string;
}

/**
 * Schedule a meeting: append a "meeting_scheduled" interaction (the date, time,
 * and notes are baked into the readable content since the schema has no meeting
 * columns), advance status -> Meeting Scheduled, and clear any pending follow-up.
 */
export async function scheduleMeeting(contactId: string, input: MeetingInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const interaction = newInteraction('meeting_scheduled', formatMeetingSummary(input.date, input.time, input.notes));
  const merged: Contact = {
    ...current,
    status: 'Meeting Scheduled',
    nextFollowUpAt: undefined, // dropped on serialization
    interactions: [...current.interactions, interaction],
  };
  return persist(userId, contactId, merged);
}

export interface MetInput {
  notes: string;
  /** Optional "YYYY-MM-DD" next follow-up date. */
  followUpAt?: string;
}

/**
 * Mark a scheduled meeting as completed: append "meeting_completed" with the
 * notes and advance status -> Met. An optional follow-up date both sets
 * nextFollowUpAt and adds a "follow_up_scheduled" interaction.
 */
export async function markMet(contactId: string, input: MetInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const now = new Date();
  const interactions = [...current.interactions, newInteraction('meeting_completed', input.notes.trim(), now)];
  let nextFollowUpAt: string | undefined;
  if (input.followUpAt) {
    nextFollowUpAt = formatFollowUpAt(input.followUpAt);
    interactions.push(
      // 1ms later so it sorts just after the completed entry
      newInteraction('follow_up_scheduled', `Follow-up scheduled for ${formatReadableDate(input.followUpAt)}`, new Date(now.getTime() + 1)),
    );
  }
  const merged: Contact = { ...current, status: 'Met', nextFollowUpAt, interactions };
  return persist(userId, contactId, merged);
}

/** Append a "note_added" interaction. Does NOT change status. */
export async function addNote(contactId: string, content: string): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const merged: Contact = {
    ...current,
    interactions: [...current.interactions, newInteraction('note_added', content.trim())],
  };
  return persist(userId, contactId, merged);
}

export interface FollowUpInput {
  /** "YYYY-MM-DD" from a date picker. */
  date: string;
  reason?: string;
}

/** Set a manual follow-up date and log it as "follow_up_scheduled". No status change. */
export async function setFollowUp(contactId: string, input: FollowUpInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const reason = input.reason?.trim();
  const when = formatReadableDate(input.date);
  const content = reason ? `Follow-up scheduled for ${when}. ${reason}` : `Follow-up scheduled for ${when}`;
  const merged: Contact = {
    ...current,
    nextFollowUpAt: formatFollowUpAt(input.date),
    interactions: [...current.interactions, newInteraction('follow_up_scheduled', content)],
  };
  return persist(userId, contactId, merged);
}

/**
 * Change status and record it as a "status_changed" interaction. Used by the
 * Move to Long-term and Mark Ghosted workflows, which carry a fixed log line.
 */
export async function changeStatusLogged(contactId: string, toStatus: Status, content: string): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const merged: Contact = {
    ...current,
    status: toStatus,
    interactions: [...current.interactions, newInteraction('status_changed', content)],
  };
  return persist(userId, contactId, merged);
}
