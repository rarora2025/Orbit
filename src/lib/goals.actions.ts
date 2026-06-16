'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import { goalImagePrompt, type Goal } from './goals';

interface Row {
  id: string;
  title: string;
  image_url: string | null;
  member_ids: string[];
  created_at: string;
  updated_at: string;
}

function rowToGoal(r: Row): Goal {
  return {
    id: r.id,
    title: r.title,
    imageUrl: r.image_url,
    memberIds: Array.isArray(r.member_ids) ? r.member_ids : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export async function listGoals(): Promise<Goal[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('goals')
    .select('id, title, image_url, member_ids, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(rowToGoal);
}

export async function addGoal(input: { title: string }): Promise<Goal> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('goals')
    .insert({ user_id: userId, title: input.title.trim(), image_url: null, member_ids: [] })
    .select('id, title, image_url, member_ids, created_at, updated_at')
    .single();
  if (error) throw error;
  return rowToGoal(data as Row);
}

export async function updateGoal(
  id: string,
  updates: Partial<Pick<Goal, 'title' | 'imageUrl'>>,
): Promise<Goal> {
  const userId = await requireUserId();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) patch.title = updates.title.trim();
  if (updates.imageUrl !== undefined) patch.image_url = updates.imageUrl;
  const { data, error } = await supabaseAdmin
    .from('goals')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('id, title, image_url, member_ids, created_at, updated_at')
    .single();
  if (error) throw error;
  return rowToGoal(data as Row);
}

export async function deleteGoal(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabaseAdmin
    .from('goals')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

async function setMembers(id: string, memberIds: string[]): Promise<Goal> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('goals')
    .update({ member_ids: memberIds, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('id, title, image_url, member_ids, created_at, updated_at')
    .single();
  if (error) throw error;
  return rowToGoal(data as Row);
}

async function requireGoal(id: string): Promise<Goal> {
  const goal = (await listGoals()).find((g) => g.id === id);
  if (!goal) throw new Error('Goal not found');
  return goal;
}

export async function addGoalMember(goalId: string, contactId: string): Promise<Goal> {
  const goal = await requireGoal(goalId);
  // Idempotent: re-adding an existing member is a no-op write.
  const next = goal.memberIds.includes(contactId)
    ? goal.memberIds
    : [...goal.memberIds, contactId];
  return setMembers(goalId, next);
}

export async function removeGoalMember(goalId: string, contactId: string): Promise<Goal> {
  const goal = await requireGoal(goalId);
  const next = goal.memberIds.filter((id) => id !== contactId);
  return setMembers(goalId, next);
}

/** Parse Pollinations media-upload responses defensively across shapes. */
function parseUploadedUrl(body: unknown): string | null {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    if (typeof o.url === 'string') return o.url;
    if (typeof o.hash === 'string') return `https://media.pollinations.ai/${o.hash}`;
    if (typeof o.cid === 'string') return `https://media.pollinations.ai/${o.cid}`;
  }
  return null;
}

/**
 * Generate an AI photo for a goal and persist a stable, key-free URL.
 * Never throws: on any problem (missing key, non-2xx, parse failure) it logs and
 * returns null, leaving the goal imageless so the UI shows its gradient fallback.
 */
export async function generateGoalImage(goalId: string, title: string): Promise<Goal | null> {
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key?.trim()) return null;
  try {
    const prompt = encodeURIComponent(goalImagePrompt(title));
    const genRes = await fetch(
      `https://gen.pollinations.ai/image/${prompt}?model=flux&width=768&height=512&nologo=true`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!genRes.ok) throw new Error(`image gen failed: ${genRes.status}`);
    const blob = await genRes.blob();

    const form = new FormData();
    form.append('file', blob, 'goal.jpg');
    const upRes = await fetch('https://media.pollinations.ai/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!upRes.ok) throw new Error(`media upload failed: ${upRes.status}`);
    const url = parseUploadedUrl(await upRes.json());
    if (!url) throw new Error('media upload returned no url');

    return await updateGoal(goalId, { imageUrl: url });
  } catch (err) {
    console.error('generateGoalImage failed', err);
    return null;
  }
}
