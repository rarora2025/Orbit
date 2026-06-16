'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import type { Contact, Status, Warmth } from './mockData';

/** What the onboarding client sends for each person to import. Sample people
 *  arrive fully specified; manually-added people send just name + company. */
export interface OnboardingContactInput {
  name: string;
  company: string;
  role?: string;
  email?: string;
  linkedinUrl?: string;
  tags?: string[];
  warmth?: Warmth;
  status?: Status;
}

export interface CompleteOnboardingInput {
  contacts: OnboardingContactInput[];
  goals: string[];
}

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

// Tailwind avatar classes cycled for the initials fallback (used only when a
// company logo doesn't resolve). Mirrors the palette feel of the orbit orbs.
const AVATAR_CLASSES = [
  'bg-indigo-500 text-white', 'bg-pink-500 text-white', 'bg-amber-500 text-white',
  'bg-emerald-500 text-white', 'bg-blue-500 text-white', 'bg-violet-500 text-white',
  'bg-teal-500 text-white', 'bg-rose-500 text-white', 'bg-sky-500 text-white',
];

const DAY = 86_400_000;

/** Turn an onboarding input into a full Contact row. Pending people get a
 *  follow-up date in the past so they surface as "going cold" on day one. */
function buildContact(input: OnboardingContactInput, index: number): Contact {
  const now = Date.now();
  const status: Status = input.status ?? 'Send';
  const isPending = status === 'Pending';
  const lastContacted = new Date(now - (isPending ? 14 : 2) * DAY).toISOString();
  return {
    id: crypto.randomUUID(),
    position: index + 1,
    name: input.name,
    company: input.company,
    role: input.role ?? '',
    linkedinUrl: input.linkedinUrl ?? '',
    email: input.email ?? '',
    notes: '',
    status,
    score: 50,
    warmth: input.warmth ?? 'Medium',
    avatarColor: AVATAR_CLASSES[index % AVATAR_CLASSES.length],
    tags: input.tags ?? [],
    lastContacted,
    // Pending people are "overdue" so they show up in next-moves / "going cold".
    nextFollowUpAt: isPending ? new Date(now - 1 * DAY).toISOString() : undefined,
    nextAction: '',
    aiSummary: '',
    outreachAngle: '',
    suggestedMessage: '',
    interactions: [],
  };
}

/**
 * Persist everything chosen during onboarding in one shot: the imported /
 * manually-added people become real contacts, and each picked goal becomes a
 * Goal row. Safe to call once at the end of the flow. Returns nothing — the app
 * re-hydrates from the DB on landing.
 */
export async function completeOnboarding(input: CompleteOnboardingInput): Promise<void> {
  const userId = await requireUserId();

  const contacts = input.contacts.map(buildContact);
  if (contacts.length > 0) {
    const rows = contacts.map((c) => ({
      id: c.id,
      user_id: userId,
      position: c.position,
      // Interactions live in their own table; the blob never carries them.
      data: { ...c, interactions: [] },
    }));
    const { error } = await supabaseAdmin.from('contacts').insert(rows);
    if (error) throw error;
  }

  const titles = input.goals.map((t) => t.trim()).filter(Boolean);
  if (titles.length > 0) {
    const goalRows = titles.map((title) => ({
      user_id: userId,
      title,
      image_url: null,
      member_ids: [] as string[],
    }));
    const { error } = await supabaseAdmin.from('goals').insert(goalRows);
    if (error) throw error;
  }
}
