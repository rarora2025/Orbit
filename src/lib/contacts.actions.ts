'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import type { Contact, Status, Interaction } from './mockData';
import { appendPosition, positionBefore } from './position';

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
