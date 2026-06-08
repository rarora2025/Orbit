'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import type { ChatSession, StoredMsg } from './chatStore';

interface Row {
  id: string;
  title: string;
  messages: StoredMsg[];
  updated_at: string;
}

function rowToSession(r: Row): ChatSession {
  return { id: r.id, title: r.title, messages: r.messages, updatedAt: new Date(r.updated_at).getTime() };
}

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export async function listSessions(): Promise<ChatSession[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, title, messages, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(rowToSession);
}

export async function upsertSession(session: ChatSession): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabaseAdmin
    .from('chat_sessions')
    .upsert({
      id: session.id,
      user_id: userId,
      title: session.title,
      messages: session.messages,
      updated_at: new Date(session.updatedAt).toISOString(),
    });
  if (error) throw error;
}

export async function deleteSession(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabaseAdmin
    .from('chat_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}
