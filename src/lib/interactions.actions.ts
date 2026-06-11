'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import type { Interaction } from './mockData';

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export interface NewInteraction {
  type: Interaction['type'];
  content: string;
  /** Structured date for meetings / follow-ups. */
  dueAt?: string;
  /** Optional creation time; defaults to now. Lets callers order multi-event writes. */
  createdAt?: string;
}

interface InteractionRow {
  id: string;
  contact_id: string;
  type: Interaction['type'];
  content: string;
  due_at: string | null;
  created_at: string;
}

function rowToInteraction(r: InteractionRow): Interaction {
  return {
    id: r.id,
    date: r.created_at,
    type: r.type,
    content: r.content,
    dueAt: r.due_at ?? undefined,
  };
}

/** Insert one interaction row, scoped to the signed-in user. */
export async function insertInteraction(contactId: string, input: NewInteraction): Promise<Interaction> {
  const userId = await requireUserId();
  const row: InteractionRow & { user_id: string } = {
    id: crypto.randomUUID(),
    user_id: userId,
    contact_id: contactId,
    type: input.type,
    content: input.content,
    due_at: input.dueAt ?? null,
    created_at: input.createdAt ?? new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from('interactions').insert(row);
  if (error) throw error;
  return rowToInteraction(row);
}

/** Load all of the signed-in user's interactions, grouped by contact id, sorted oldest→newest. */
export async function listUserInteractions(): Promise<Map<string, Interaction[]>> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('interactions')
    .select('id, contact_id, type, content, due_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const byContact = new Map<string, Interaction[]>();
  for (const r of (data as InteractionRow[]) ?? []) {
    const list = byContact.get(r.contact_id) ?? [];
    list.push(rowToInteraction(r));
    byContact.set(r.contact_id, list);
  }
  return byContact;
}
