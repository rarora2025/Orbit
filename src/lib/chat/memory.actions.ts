'use server';

import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '../supabase';

const MEMORY_MODEL = 'gpt-4o-mini';
const MAX_PROFILE_CHARS = 1500;

async function userId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/** Read the user's profile memory. Returns '' on any problem (incl. missing table). */
export async function getProfileMemory(): Promise<string> {
  try {
    const uid = await userId();
    if (!uid) return '';
    const { data, error } = await supabaseAdmin
      .from('user_context')
      .select('profile')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) return '';
    return (data?.profile as string) ?? '';
  } catch {
    return '';
  }
}

/**
 * Rewrite the user's profile memory from the prior profile + the latest exchange.
 * Cheap, fire-and-forget, and never throws — memory is a nice-to-have, so a
 * missing table or absent API key just no-ops.
 */
export async function updateProfileMemory(exchange: { user: string; assistant: string }): Promise<void> {
  try {
    const uid = await userId();
    if (!uid) return;
    const apiKey = process.env.OPEN_AI_KEY;
    if (!apiKey) return;

    const prior = await getProfileMemory();
    const openai = new OpenAI({ apiKey });
    const res = await openai.chat.completions.create({
      model: MEMORY_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You maintain a concise running profile of a user of a personal CRM, used to personalize an assistant. ' +
            'Given the existing profile and a new exchange, return an UPDATED profile capturing durable facts only: ' +
            'their role/identity, what they are working toward (goals), preferences (tone, channels), and stable context. ' +
            'Omit transient chatter. Keep it under 1200 characters, plain text, no preamble — return only the profile.',
        },
        {
          role: 'user',
          content: `Existing profile:\n${prior || '(none yet)'}\n\nNew exchange:\nUser: ${exchange.user}\nAssistant: ${exchange.assistant}`,
        },
      ],
    });
    const profile = res.choices[0]?.message?.content?.trim();
    if (!profile) return;

    await supabaseAdmin
      .from('user_context')
      .upsert({ user_id: uid, profile: profile.slice(0, MAX_PROFILE_CHARS), updated_at: new Date().toISOString() });
  } catch (err) {
    console.warn('updateProfileMemory skipped', err);
  }
}
