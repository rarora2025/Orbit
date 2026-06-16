'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import { toggleMember, type Goal } from './goals';

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
  const next = goal.memberIds.includes(contactId) ? goal.memberIds : toggleMember(goal.memberIds, contactId);
  return setMembers(goalId, next);
}

export async function removeGoalMember(goalId: string, contactId: string): Promise<Goal> {
  const goal = await requireGoal(goalId);
  const next = goal.memberIds.includes(contactId) ? toggleMember(goal.memberIds, contactId) : goal.memberIds;
  return setMembers(goalId, next);
}
