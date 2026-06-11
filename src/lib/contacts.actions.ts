'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import type { Contact, Status } from './mockData';
import { appendPosition, positionBefore } from './position';
import { formatMeetingSummary, formatFollowUpAt, formatReadableDate } from './meeting';
import { listUserInteractions, insertInteraction } from './interactions.actions';

interface Row {
  id: string;
  position: number;
  data: Contact;
}

function rowToContact(r: Row): Contact {
  // The full contact lives in `data`; id/position are authoritative columns.
  // Back-compat: older rows stored `relationshipGoal`/`inquiry`/`priority`.
  const { relationshipGoal, inquiry, priority, ...rest } = r.data as Contact & {
    relationshipGoal?: string;
    inquiry?: string;
    priority?: string;
  };
  void inquiry; void priority; // intentionally dropped
  return { ...rest, goal: rest.goal ?? relationshipGoal, id: r.id, position: r.position };
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
  const byContact = await listUserInteractions();
  return (data as Row[]).map((r) => {
    const contact = rowToContact(r);
    // The interactions table is the source of truth; show newest first.
    contact.interactions = [...(byContact.get(r.id) ?? [])].reverse();
    return contact;
  });
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
  // Strip interactions from the blob (table is the source of truth) but keep
  // them on the returned contact so the store's timeline stays populated.
  return persist(userId, id, merged);
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
    // Strip interactions from the blob; the table is the source of truth.
    .update({ position, data: { ...merged, interactions: [] }, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('id, position, data')
    .single();
  if (error) throw error;
  // Return `merged` (with real interactions), not the stripped blob row.
  return { ...merged, id, position: (data as Row).position };
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

// --- Shared helpers for the lifecycle workflows below -----------------------

/** Load the current contact, scoped to the signed-in user. */
async function requireContact(contactId: string): Promise<{ userId: string; current: Contact }> {
  const userId = await requireUserId();
  const current = (await listContacts()).find((c) => c.id === contactId);
  if (!current) throw new Error('Contact not found');
  return { userId, current };
}

/** Persist a contact's `data` blob (interactions are stored in their own table). */
async function persist(userId: string, contactId: string, merged: Contact): Promise<Contact> {
  const dataToStore: Contact = { ...merged, interactions: [] };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ data: dataToStore, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', contactId)
    .select('id, position, data')
    .single();
  if (error) throw error;
  // Return the caller's `merged` (with its real interactions), not the stripped blob.
  return { ...merged, id: contactId, position: (data as Row).position };
}

export interface ResponseInput {
  /** Free-text summary of the reply. */
  content: string;
  /** Optional captured next step (e.g. "Schedule meeting"); appended to content. */
  nextStep?: string;
}

/** Append a "message_drafted" interaction. Does NOT change status. */
export async function addDraftInteraction(contactId: string, input: InteractionInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const interaction = await insertInteraction(contactId, { type: 'message_drafted', content: input.content });
  return persist(userId, contactId, { ...current, interactions: [...current.interactions, interaction] });
}

/**
 * Append "message_sent" + "follow_up_scheduled" interactions and advance the
 * contact: status -> Pending, lastContacted = now, nextFollowUpAt = now + 7 days.
 */
export async function markMessageSent(contactId: string, input: InteractionInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const now = new Date();
  const nextFollowUpAt = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const sent = await insertInteraction(contactId, {
    type: 'message_sent', content: input.content, createdAt: now.toISOString(),
  });
  const followUp = await insertInteraction(contactId, {
    type: 'follow_up_scheduled',
    content: 'Follow up if no response in 7 days',
    dueAt: nextFollowUpAt,
    createdAt: new Date(now.getTime() + 1).toISOString(), // sorts just after "sent"
  });

  return persist(userId, contactId, {
    ...current,
    status: 'Pending',
    lastContacted: now.toISOString(),
    nextFollowUpAt,
    interactions: [...current.interactions, sent, followUp],
  });
}

export async function logResponse(contactId: string, input: ResponseInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  // nextStep is persisted to the interactions table (next_step column) so the
  // chip survives reloads, then returned on the interaction for the live update.
  const interaction = await insertInteraction(contactId, {
    type: 'response_logged', content: input.content.trim(), nextStep: input.nextStep,
  });
  return persist(userId, contactId, {
    ...current,
    status: 'Response',
    nextFollowUpAt: undefined,
    interactions: [...current.interactions, interaction],
  });
}

export interface MeetingInput {
  /** "YYYY-MM-DD" from a date picker. */
  date: string;
  /** "HH:MM" (24h) from a time picker; may be blank. */
  time: string;
  notes: string;
}

export interface MetInput {
  notes: string;
  /** Optional "YYYY-MM-DD" next follow-up date. */
  followUpAt?: string;
}

export interface FollowUpInput {
  /** "YYYY-MM-DD" from a date picker. */
  date: string;
  reason?: string;
}

export async function scheduleMeeting(contactId: string, input: MeetingInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const dueAt = input.time
    ? new Date(`${input.date}T${input.time}`).toISOString()
    : new Date(`${input.date}T12:00:00`).toISOString();
  const interaction = await insertInteraction(contactId, {
    type: 'meeting_scheduled',
    content: formatMeetingSummary(input.date, input.time, input.notes),
    dueAt,
  });
  return persist(userId, contactId, {
    ...current,
    status: 'Meeting Scheduled',
    nextFollowUpAt: undefined,
    interactions: [...current.interactions, interaction],
  });
}

export async function markMet(contactId: string, input: MetInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const now = new Date();
  const completed = await insertInteraction(contactId, {
    type: 'meeting_completed', content: input.notes.trim(), createdAt: now.toISOString(),
  });
  const interactions = [...current.interactions, completed];
  let nextFollowUpAt: string | undefined;
  if (input.followUpAt) {
    nextFollowUpAt = formatFollowUpAt(input.followUpAt);
    const followUp = await insertInteraction(contactId, {
      type: 'follow_up_scheduled',
      content: `Follow-up scheduled for ${formatReadableDate(input.followUpAt)}`,
      dueAt: nextFollowUpAt,
      createdAt: new Date(now.getTime() + 1).toISOString(),
    });
    interactions.push(followUp);
  }
  return persist(userId, contactId, { ...current, status: 'Met', nextFollowUpAt, interactions });
}

export async function addNote(contactId: string, content: string): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const interaction = await insertInteraction(contactId, { type: 'note_added', content: content.trim() });
  return persist(userId, contactId, { ...current, interactions: [...current.interactions, interaction] });
}

export async function setFollowUp(contactId: string, input: FollowUpInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const reason = input.reason?.trim();
  const when = formatReadableDate(input.date);
  const dueAt = formatFollowUpAt(input.date);
  const content = reason ? `Follow-up scheduled for ${when}. ${reason}` : `Follow-up scheduled for ${when}`;
  const interaction = await insertInteraction(contactId, { type: 'follow_up_scheduled', content, dueAt });
  return persist(userId, contactId, {
    ...current,
    nextFollowUpAt: dueAt,
    interactions: [...current.interactions, interaction],
  });
}

/**
 * Change status and record it as a "status_changed" interaction. Used by the
 * Move to Long-term and Mark Ghosted workflows, which carry a fixed log line.
 */
export async function changeStatusLogged(contactId: string, toStatus: Status, content: string): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const interaction = await insertInteraction(contactId, { type: 'status_changed', content });
  return persist(userId, contactId, {
    ...current,
    status: toStatus,
    interactions: [...current.interactions, interaction],
  });
}
