# Goals as First-Class Entities (with AI photo + people) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make goals first-class entities (title + AI-generated photo + associated people), creatable from the Insights page, and replace the open-ended free-text "goal" field on contacts with membership in existing goals only.

**Architecture:** A new per-user Supabase `goals` table is the single source of truth for goal↔person membership (`member_ids` JSONB). Server actions (`goals.actions.ts`, service-role + Clerk-scoped, mirroring `contacts.actions.ts`) do CRUD + membership + AI image generation via Pollinations (server-side key, re-hosted to a key-free URL). A Zustand `goalsStore` (mirroring `store.ts`) drives the UI. The Insights page gets a Goals rail + create/detail modals; the person detail panel gets a goal-membership picker. `contact.goal` becomes a read-only value derived in `listContacts` from membership, so AI draft context keeps working unchanged.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript, Zustand, Supabase (`@supabase/supabase-js`, service-role), Clerk auth, Tailwind v4, Vitest. Pollinations image API (`gen.pollinations.ai` + `media.pollinations.ai`).

---

## Spec reference

`docs/superpowers/specs/2026-06-15-goals-entity-ai-photo-design.md`

## File structure

**Create:**
- `docs/superpowers/sql/2026-06-15-goals-table.sql` — `goals` DDL (user runs in Supabase).
- `src/lib/goals.ts` — `Goal` type + pure helpers (`goalImagePrompt`, `toggleMember`).
- `src/lib/goals.ts` test → `src/lib/goals.test.ts`.
- `src/lib/goals.actions.ts` (+ `src/lib/goals.actions.test.ts`) — server actions.
- `src/lib/goalsStore.ts` (+ `src/lib/goalsStore.test.ts`) — Zustand store.
- `src/components/GoalCard.tsx` — one goal card.
- `src/components/NewGoalModal.tsx` — title-only create modal.
- `src/components/GoalDetailModal.tsx` — image/regenerate, title edit, members, add-people, delete.

**Modify:**
- `src/lib/contacts.actions.ts` — derive `contact.goal` from membership in `listContacts`.
- `src/components/ContactModal.tsx` — remove the free-text Goals field.
- `src/components/StoreHydrator.tsx` — hydrate goals.
- `src/components/ContactDetailPanel.tsx` — Goals section → membership chips + picker.
- `src/app/(app)/page.tsx` — Goals rail + modals.
- `.env.local` — add `POLLINATIONS_API_KEY`.

**Note on UI tests:** the repo has no React component test setup (Vitest only, no `@testing-library/react`); existing components have no unit tests. So UI components (`GoalCard`, modals, page wiring) are verified by `npm run lint` + `npm run build` + manual acceptance. All non-trivial logic is extracted into `src/lib/goals.ts` and `goalsStore.ts`, which ARE unit-tested.

---

## Task 1: `goals` table SQL + `Goal` type + pure helpers

**Files:**
- Create: `docs/superpowers/sql/2026-06-15-goals-table.sql`
- Create: `src/lib/goals.ts`
- Test: `src/lib/goals.test.ts`

- [ ] **Step 1: Write the SQL file**

Create `docs/superpowers/sql/2026-06-15-goals-table.sql`:

```sql
-- Run in the Supabase SQL editor (same setup as the contacts table).
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  title       text not null,
  image_url   text,
  member_ids  jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index goals_user_id_idx on public.goals (user_id);
alter table public.goals enable row level security;
-- No permissive policy: only the service-role key (our server actions) read/write.
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/goals.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { goalImagePrompt, toggleMember } from './goals';

describe('goalImagePrompt', () => {
  it('embeds the title in a tasteful default style prompt', () => {
    const p = goalImagePrompt('Break into VC');
    expect(p).toContain('Break into VC');
    expect(p.toLowerCase()).toContain('illustration');
  });

  it('trims surrounding whitespace from the title', () => {
    expect(goalImagePrompt('  Recruiting  ')).toContain('"Recruiting"');
  });
});

describe('toggleMember', () => {
  it('adds an absent id', () => {
    expect(toggleMember(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('removes a present id', () => {
    expect(toggleMember(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('does not mutate the input array', () => {
    const input = ['a'];
    toggleMember(input, 'b');
    expect(input).toEqual(['a']);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/lib/goals.test.ts`
Expected: FAIL — `Cannot find module './goals'`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/goals.ts`:

```ts
/** A goal the user is pursuing — title, AI photo, and the people tied to it. */
export interface Goal {
  id: string;
  title: string;
  /** AI-generated, key-free media URL. `null` while generating or on failure. */
  imageUrl: string | null;
  /** Contact ids associated with this goal (single source of truth for the link). */
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Default, tasteful image prompt built from a goal title (no user prompt-writing). */
export function goalImagePrompt(title: string): string {
  return `"${title.trim()}", minimal modern editorial illustration, soft warm palette, abstract, no text`;
}

/** Add the id if absent, remove it if present. Pure — returns a new array. */
export function toggleMember(memberIds: string[], contactId: string): string[] {
  return memberIds.includes(contactId)
    ? memberIds.filter((id) => id !== contactId)
    : [...memberIds, contactId];
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/lib/goals.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/sql/2026-06-15-goals-table.sql src/lib/goals.ts src/lib/goals.test.ts
git commit -m "feat(goals): goals table SQL, Goal type, and pure helpers"
```

---

## Task 2: `goals.actions.ts` — CRUD + membership

**Files:**
- Create: `src/lib/goals.actions.ts`
- Test: `src/lib/goals.actions.test.ts`

This mirrors `src/lib/contacts.actions.ts`: `'use server'`, `requireUserId()` scoping, `supabaseAdmin` service-role client, every query filtered by `user_id`. `generateGoalImage` is added in Task 3.

- [ ] **Step 1: Write the failing test**

Create `src/lib/goals.actions.test.ts` (Supabase + Clerk mocked exactly like `contacts.actions.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const del = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

const single = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ data: [], error: null });
  single.mockResolvedValue({ data: { id: 'g1', user_id: 'user_123', title: 'T', image_url: null, member_ids: [], created_at: '', updated_at: '' }, error: null });
  eq.mockReturnValue({ order, eq, select, single });
  select.mockReturnValue({ eq, order, single });
  insert.mockReturnValue({ select: () => ({ single }) });
  update.mockReturnValue({ eq });
  del.mockReturnValue({ eq });
  from.mockReturnValue({ select, insert, update, delete: del });
  authMock.mockResolvedValue({ userId: 'user_123' });
});

describe('listGoals', () => {
  it('throws when there is no signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { listGoals } = await import('./goals.actions');
    await expect(listGoals()).rejects.toThrow(/auth/i);
  });

  it('scopes the read to the Clerk userId and maps rows to Goal', async () => {
    order.mockResolvedValueOnce({
      data: [{ id: 'g1', user_id: 'user_123', title: 'Recruiting', image_url: 'http://x/y', member_ids: ['c1'], created_at: 'a', updated_at: 'b' }],
      error: null,
    });
    const { listGoals } = await import('./goals.actions');
    const goals = await listGoals();
    expect(from).toHaveBeenCalledWith('goals');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(goals[0]).toEqual({ id: 'g1', title: 'Recruiting', imageUrl: 'http://x/y', memberIds: ['c1'], createdAt: 'a', updatedAt: 'b' });
  });
});

describe('addGoal', () => {
  it('inserts a goal scoped to the userId with empty members and no image', async () => {
    const { addGoal } = await import('./goals.actions');
    await addGoal({ title: 'New Goal' });
    const payload = insert.mock.calls[0][0];
    expect(payload.user_id).toBe('user_123');
    expect(payload.title).toBe('New Goal');
    expect(payload.member_ids).toEqual([]);
    expect(payload.image_url).toBeNull();
  });
});

describe('deleteGoal', () => {
  it('scopes the delete to the userId and the id', async () => {
    const { deleteGoal } = await import('./goals.actions');
    await deleteGoal('g1');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 'g1');
  });
});

describe('addGoalMember / removeGoalMember', () => {
  function seedGoal(memberIds: string[]) {
    order.mockResolvedValueOnce({
      data: [{ id: 'g1', user_id: 'user_123', title: 'T', image_url: null, member_ids: memberIds, created_at: '', updated_at: '' }],
      error: null,
    });
  }

  it('addGoalMember appends a contact id, scoped to user + goal', async () => {
    seedGoal([]);
    const { addGoalMember } = await import('./goals.actions');
    await addGoalMember('g1', 'c1');
    expect(update.mock.calls[0][0].member_ids).toEqual(['c1']);
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 'g1');
  });

  it('addGoalMember is a no-op when the contact is already a member', async () => {
    seedGoal(['c1']);
    const { addGoalMember } = await import('./goals.actions');
    await addGoalMember('g1', 'c1');
    expect(update.mock.calls[0][0].member_ids).toEqual(['c1']);
  });

  it('removeGoalMember drops the contact id', async () => {
    seedGoal(['c1', 'c2']);
    const { removeGoalMember } = await import('./goals.actions');
    await removeGoalMember('g1', 'c1');
    expect(update.mock.calls[0][0].member_ids).toEqual(['c2']);
  });

  it('member ops on a foreign goal id throw (goal not found)', async () => {
    seedGoal([]); // listGoals returns only g1
    const { addGoalMember } = await import('./goals.actions');
    await expect(addGoalMember('does-not-exist', 'c1')).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/goals.actions.test.ts`
Expected: FAIL — `Cannot find module './goals.actions'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/goals.actions.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/goals.actions.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/goals.actions.ts src/lib/goals.actions.test.ts
git commit -m "feat(goals): goals server actions (CRUD + membership)"
```

---

## Task 3: `generateGoalImage` (Pollinations) + env

**Files:**
- Modify: `src/lib/goals.actions.ts`
- Modify: `.env.local`
- Test: `src/lib/goals.actions.test.ts` (add cases)

- [ ] **Step 1: Add the Pollinations key to `.env.local`**

Append this line to `.env.local` (file is gitignored; do NOT commit it):

```
POLLINATIONS_API_KEY=sk_XKJRsXCZuROC7XBHIW1MsPmsjbnzE4Zw
```

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/goals.actions.test.ts`:

```ts
describe('generateGoalImage', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; delete process.env.POLLINATIONS_API_KEY; });

  function seedGoalForUpdate() {
    // updateGoal({imageUrl}) returns the patched goal via .single()
    single.mockResolvedValue({ data: { id: 'g1', user_id: 'user_123', title: 'T', image_url: 'http://media/x', member_ids: [], created_at: '', updated_at: '' }, error: null });
  }

  it('returns null and skips network when the key is missing', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { generateGoalImage } = await import('./goals.actions');
    const result = await generateGoalImage('g1', 'T');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('generates, re-hosts, and persists the key-free url', async () => {
    process.env.POLLINATIONS_API_KEY = 'sk_test';
    seedGoalForUpdate();
    globalThis.fetch = vi.fn()
      // 1) image generation -> bytes
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['img'], { type: 'image/jpeg' }) })
      // 2) media upload -> { url }
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'http://media/x' }) }) as unknown as typeof fetch;

    const { generateGoalImage } = await import('./goals.actions');
    const goal = await generateGoalImage('g1', 'T');
    expect(goal?.imageUrl).toBe('http://media/x');
    // Persisted via updateGoal -> goals table update with image_url
    expect(update.mock.calls.some((c) => c[0].image_url === 'http://media/x')).toBe(true);
  });

  it('returns null without throwing when generation fails', async () => {
    process.env.POLLINATIONS_API_KEY = 'sk_test';
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }) as unknown as typeof fetch;
    const { generateGoalImage } = await import('./goals.actions');
    expect(await generateGoalImage('g1', 'T')).toBeNull();
  });
});
```

Also add `afterEach` to the imports at the top of the file:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

- [ ] **Step 3: Run to verify failure**

Run: `npm run test -- src/lib/goals.actions.test.ts`
Expected: FAIL — `generateGoalImage` is not exported.

- [ ] **Step 4: Implement `generateGoalImage`**

Add to `src/lib/goals.actions.ts` (import `goalImagePrompt` alongside the existing imports — update the import line to `import { goalImagePrompt, toggleMember, type Goal } from './goals';`):

```ts
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
  if (!key) return null;
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- src/lib/goals.actions.test.ts`
Expected: PASS (CRUD + membership + image cases).

- [ ] **Step 6: Commit (do NOT add `.env.local`)**

```bash
git add src/lib/goals.actions.ts src/lib/goals.actions.test.ts
git commit -m "feat(goals): server-side AI image generation via Pollinations"
```

---

## Task 4: `goalsStore.ts` (Zustand)

**Files:**
- Create: `src/lib/goalsStore.ts`
- Test: `src/lib/goalsStore.test.ts`

Mirrors `src/lib/store.ts`: in-memory state, `setGoals` hydrator, optimistic apply + server write. `addGoal` inserts immediately then patches `imageUrl` when `generateGoalImage` resolves.

- [ ] **Step 1: Write the failing test**

Create `src/lib/goalsStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./goals.actions', () => ({
  listGoals: vi.fn(),
  addGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  addGoalMember: vi.fn(),
  removeGoalMember: vi.fn(),
  generateGoalImage: vi.fn(),
}));

import { useGoalsStore } from './goalsStore';
import type { Goal } from './goals';
import * as api from './goals.actions';

function g(id: string, memberIds: string[] = [], imageUrl: string | null = null): Goal {
  return { id, title: id, imageUrl, memberIds, createdAt: '', updatedAt: '' };
}

beforeEach(() => {
  useGoalsStore.setState({ goals: [], loaded: false });
  vi.clearAllMocks();
});

describe('goalsStore hydration', () => {
  it('setGoals replaces goals and marks loaded', () => {
    useGoalsStore.getState().setGoals([g('a'), g('b')]);
    expect(useGoalsStore.getState().goals.map((x) => x.id)).toEqual(['a', 'b']);
    expect(useGoalsStore.getState().loaded).toBe(true);
  });
});

describe('goalsStore.addGoal', () => {
  it('inserts the created goal then patches in the generated image', async () => {
    (api.addGoal as ReturnType<typeof vi.fn>).mockResolvedValue(g('a'));
    (api.generateGoalImage as ReturnType<typeof vi.fn>).mockResolvedValue(g('a', [], 'http://img'));
    await useGoalsStore.getState().addGoal('My Goal');
    expect(api.addGoal).toHaveBeenCalledWith({ title: 'My Goal' });
    expect(api.generateGoalImage).toHaveBeenCalledWith('a', 'a');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.imageUrl).toBe('http://img');
  });

  it('keeps the goal imageless when generation returns null', async () => {
    (api.addGoal as ReturnType<typeof vi.fn>).mockResolvedValue(g('a'));
    (api.generateGoalImage as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await useGoalsStore.getState().addGoal('My Goal');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.imageUrl).toBeNull();
  });
});

describe('goalsStore membership + delete', () => {
  it('addMember upserts the returned goal', async () => {
    (api.addGoalMember as ReturnType<typeof vi.fn>).mockResolvedValue(g('a', ['c1']));
    useGoalsStore.setState({ goals: [g('a')], loaded: true });
    await useGoalsStore.getState().addMember('a', 'c1');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.memberIds).toEqual(['c1']);
  });

  it('removeMember upserts the returned goal', async () => {
    (api.removeGoalMember as ReturnType<typeof vi.fn>).mockResolvedValue(g('a', []));
    useGoalsStore.setState({ goals: [g('a', ['c1'])], loaded: true });
    await useGoalsStore.getState().removeMember('a', 'c1');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.memberIds).toEqual([]);
  });

  it('deleteGoal removes it from the store', async () => {
    (api.deleteGoal as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    useGoalsStore.setState({ goals: [g('a'), g('b')], loaded: true });
    await useGoalsStore.getState().deleteGoal('a');
    expect(useGoalsStore.getState().goals.map((x) => x.id)).toEqual(['b']);
  });

  it('regenerateImage patches the returned image url', async () => {
    (api.generateGoalImage as ReturnType<typeof vi.fn>).mockResolvedValue(g('a', [], 'http://new'));
    useGoalsStore.setState({ goals: [g('a')], loaded: true });
    await useGoalsStore.getState().regenerateImage('a');
    expect(api.generateGoalImage).toHaveBeenCalledWith('a', 'a');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.imageUrl).toBe('http://new');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- src/lib/goalsStore.test.ts`
Expected: FAIL — `Cannot find module './goalsStore'`.

- [ ] **Step 3: Implement the store**

Create `src/lib/goalsStore.ts`:

```ts
'use client';

import { create } from 'zustand';
import type { Goal } from './goals';
import * as api from './goals.actions';

interface GoalsStore {
  goals: Goal[];
  loaded: boolean;
  setGoals: (goals: Goal[]) => void;
  addGoal: (title: string) => Promise<void>;
  renameGoal: (id: string, title: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addMember: (goalId: string, contactId: string) => Promise<void>;
  removeMember: (goalId: string, contactId: string) => Promise<void>;
  regenerateImage: (id: string) => Promise<void>;
}

export const useGoalsStore = create<GoalsStore>()((set, get) => {
  const upsert = (goal: Goal) =>
    set((s) => ({ goals: [...s.goals.filter((g) => g.id !== goal.id), goal] }));

  return {
    goals: [],
    loaded: false,
    setGoals: (goals) => set({ goals, loaded: true }),
    addGoal: async (title) => {
      const created = await api.addGoal({ title });
      upsert(created);
      // Generate the photo in the background; patch it in when ready.
      const withImage = await api.generateGoalImage(created.id, created.title);
      if (withImage) upsert(withImage);
    },
    renameGoal: async (id, title) => { upsert(await api.updateGoal(id, { title })); },
    deleteGoal: async (id) => {
      await api.deleteGoal(id);
      set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    },
    addMember: async (goalId, contactId) => { upsert(await api.addGoalMember(goalId, contactId)); },
    removeMember: async (goalId, contactId) => { upsert(await api.removeGoalMember(goalId, contactId)); },
    regenerateImage: async (id) => {
      const goal = get().goals.find((g) => g.id === id);
      if (!goal) return;
      const updated = await api.generateGoalImage(id, goal.title);
      if (updated) upsert(updated);
    },
  };
});
```

Note: `updateGoal` is exported from `goals.actions` (Task 2) — `renameGoal` uses it.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- src/lib/goalsStore.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/goalsStore.ts src/lib/goalsStore.test.ts
git commit -m "feat(goals): goalsStore (optimistic CRUD + membership + image)"
```

---

## Task 5: Derive `contact.goal` from membership; hydrate goals

**Files:**
- Modify: `src/lib/contacts.actions.ts:34-49` (`listContacts`)
- Modify: `src/components/StoreHydrator.tsx`
- Test: `src/lib/contacts.actions.test.ts` (add a derivation case)

- [ ] **Step 1: Write the failing test**

Add to `src/lib/contacts.actions.test.ts`. First, extend the `beforeEach` mock so a third `.from('goals')` read is chainable — the existing `from` already returns `{ select, insert, delete: del }` and `select` returns `{ eq, order }`, so a `goals` select resolves through `order`. Add this test:

```ts
describe('listContacts goal derivation from membership', () => {
  it('sets contact.goal to the joined titles of goals the contact belongs to', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    // 1) contacts read, 2) interactions read, 3) goals read — in call order.
    order
      .mockResolvedValueOnce({
        data: [
          { id: 'c1', position: 1000, data: { id: 'c1', status: 'Send', goal: 'STALE', interactions: [] } },
          { id: 'c2', position: 2000, data: { id: 'c2', status: 'Send', goal: 'ALSO STALE', interactions: [] } },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null }) // interactions
      .mockResolvedValueOnce({
        data: [
          { id: 'g1', title: 'Recruiting', image_url: null, member_ids: ['c1'], created_at: '', updated_at: '' },
          { id: 'g2', title: 'Fundraising', image_url: null, member_ids: ['c1'], created_at: '', updated_at: '' },
        ],
        error: null,
      });

    const { listContacts } = await import('./contacts.actions');
    const contacts = await listContacts();
    expect(contacts.find((c) => c.id === 'c1')?.goal).toBe('Recruiting, Fundraising');
    expect(contacts.find((c) => c.id === 'c2')?.goal).toBeUndefined(); // cleared despite stale blob value
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- src/lib/contacts.actions.test.ts`
Expected: FAIL — `c1.goal` is `'STALE'` (or `undefined`), not `'Recruiting, Fundraising'`.

- [ ] **Step 3: Implement the derivation in `listContacts`**

In `src/lib/contacts.actions.ts`, replace the body of `listContacts` (lines ~34-49) with the version below. It adds a `goals` read and overwrites each contact's `goal` from membership (the stored blob `goal` is ignored). Also update `rowToContact` so it no longer carries a stored `goal` through (the derivation is the only writer):

```ts
export async function listContacts(): Promise<Contact[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('id, position, data')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  const byContact = await listUserInteractions();

  // Goal membership is the single source of truth for a contact's goal text.
  const { data: goalRows } = await supabaseAdmin
    .from('goals')
    .select('title, member_ids')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  const titlesByContact = new Map<string, string[]>();
  for (const row of (goalRows ?? []) as { title: string; member_ids: string[] }[]) {
    for (const cid of Array.isArray(row.member_ids) ? row.member_ids : []) {
      titlesByContact.set(cid, [...(titlesByContact.get(cid) ?? []), row.title]);
    }
  }

  return (data as Row[]).map((r) => {
    const contact = rowToContact(r);
    contact.interactions = [...(byContact.get(r.id) ?? [])].reverse();
    const titles = titlesByContact.get(r.id);
    contact.goal = titles && titles.length > 0 ? titles.join(', ') : undefined;
    return contact;
  });
}
```

Then in `rowToContact` (line ~16-26), drop the stored `goal`/`relationshipGoal` from the returned object so the derived value is authoritative:

```ts
function rowToContact(r: Row): Contact {
  // The full contact lives in `data`; id/position are authoritative columns.
  // `goal` is intentionally NOT read from the blob — it is derived from goal
  // membership in listContacts (the single source of truth). Older rows stored
  // `relationshipGoal`/`inquiry`/`priority`; all are discarded on next write.
  const { relationshipGoal, inquiry, priority, goal, ...rest } = r.data as Contact & {
    relationshipGoal?: string;
    inquiry?: string;
    priority?: string;
  };
  void inquiry; void priority; void relationshipGoal; void goal;
  return { ...rest, id: r.id, position: r.position };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- src/lib/contacts.actions.test.ts`
Expected: PASS (existing cases + the new derivation case).

- [ ] **Step 5: Hydrate goals in `StoreHydrator`**

Replace `src/components/StoreHydrator.tsx` with:

```tsx
'use client';

import { useEffect } from 'react';
import { useCRMStore } from '@/lib/store';
import { useChatStore } from '@/lib/chatStore';
import { useGoalsStore } from '@/lib/goalsStore';
import { listContacts } from '@/lib/contacts.actions';
import { listSessions } from '@/lib/chats.actions';
import { listGoals } from '@/lib/goals.actions';

/** Loads the signed-in user's contacts, chat sessions, and goals into the stores once. */
export default function StoreHydrator() {
  const setContacts = useCRMStore((s) => s.setContacts);
  const setSessions = useChatStore((s) => s.setSessions);
  const setGoals = useGoalsStore((s) => s.setGoals);
  useEffect(() => {
    listContacts().then(setContacts).catch((e) => console.error('Failed to load contacts', e));
    listSessions().then(setSessions).catch((e) => console.error('Failed to load chats', e));
    listGoals().then(setGoals).catch((e) => console.error('Failed to load goals', e));
  }, [setContacts, setSessions, setGoals]);
  return null;
}
```

- [ ] **Step 6: Run the full suite + lint**

Run: `npm run test && npm run lint`
Expected: all tests PASS, lint clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/contacts.actions.ts src/lib/contacts.actions.test.ts src/components/StoreHydrator.tsx
git commit -m "feat(goals): derive contact.goal from membership; hydrate goals"
```

---

## Task 6: Remove the free-text Goals field from `ContactModal`

**Files:**
- Modify: `src/components/ContactModal.tsx`

There is no unit test for this component (no React test setup); verify via lint + build + manual.

- [ ] **Step 1: Remove `GOAL_SUGGESTIONS`**

Delete this block (lines ~25-29):

```tsx
// Common reasons to track someone — power the goals datalist.
const GOAL_SUGGESTIONS = [
  'DraftIQ advice', 'Internship help', 'Founder mentor', 'Investor',
  'Professor / research', 'Customer discovery', 'Friend / classmate',
];
```

- [ ] **Step 2: Remove `goal` from form state**

In the `useState` initializer (line ~33-42), delete the line:

```tsx
    goal: contact?.goal ?? '',
```

- [ ] **Step 3: Remove `goal` from the edit `onSave` payload**

In `handleSubmit`'s edit branch (line ~55-65), delete:

```tsx
        goal: form.goal.trim(),
```

- [ ] **Step 4: Remove `goal` from the new-contact object**

In the `newContact` object (line ~72-97), delete:

```tsx
      goal: form.goal.trim(),
```

- [ ] **Step 5: Remove the Goals field markup**

Delete the entire Goals block (lines ~170-183):

```tsx
          {/* Goals */}
          <div>
            <label className={labelClass}>Goals</label>
            <input
              className={inputClass}
              list="relationship-goals"
              placeholder="Why do you care about this person?"
              value={form.goal}
              onChange={e => handleChange('goal', e.target.value)}
            />
            <datalist id="relationship-goals">
              {GOAL_SUGGESTIONS.map(g => <option key={g} value={g} />)}
            </datalist>
          </div>
```

- [ ] **Step 6: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: clean (no unused `goal`/`GOAL_SUGGESTIONS` references).

- [ ] **Step 7: Commit**

```bash
git add src/components/ContactModal.tsx
git commit -m "feat(goals): remove free-text goal field from contact modal"
```

---

## Task 7: `GoalCard` component

**Files:**
- Create: `src/components/GoalCard.tsx`

Renders one goal: AI image banner (or gradient + initial fallback; spinner while no image yet), title, and a small stack of member avatars + overflow count. Pure presentational — takes the goal + its member contacts + an onClick.

- [ ] **Step 1: Implement the component**

Create `src/components/GoalCard.tsx`:

```tsx
'use client';

import type { Goal } from '@/lib/goals';
import type { Contact } from '@/lib/mockData';

interface Props {
  goal: Goal;
  members: Contact[];
  /** True right after creation, before the first image resolves. */
  generating?: boolean;
  onClick: () => void;
}

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export default function GoalCard({ goal, members, generating, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-[220px] flex-shrink-0 text-left rounded-2xl border border-stone-200 bg-white overflow-hidden hover:border-stone-300 hover:shadow-md transition active:scale-[0.99]"
    >
      {/* Image banner / fallback */}
      <div className="relative h-28 w-full bg-gradient-to-br from-orange-100 via-amber-100 to-rose-100 flex items-center justify-center">
        {goal.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={goal.imageUrl} alt={goal.title} className="h-full w-full object-cover" />
        ) : generating ? (
          <span className="w-5 h-5 rounded-full border-2 border-orange-300 border-t-orange-500 animate-spin" />
        ) : (
          <span className="text-3xl font-bold text-orange-400/80">{initial(goal.title)}</span>
        )}
      </div>

      {/* Title + members */}
      <div className="px-3.5 py-3">
        <p className="text-[14px] font-bold text-stone-900 leading-snug line-clamp-2">{goal.title}</p>
        <div className="flex items-center gap-1.5 mt-2.5 min-h-[24px]">
          {members.length === 0 ? (
            <span className="text-[12px] text-stone-400">No people yet</span>
          ) : (
            <>
              <span className="flex -space-x-2">
                {members.slice(0, 4).map((m) => (
                  <span
                    key={m.id}
                    title={m.name}
                    className={`w-6 h-6 rounded-full ring-2 ring-white flex items-center justify-center text-[11px] font-semibold ${m.avatarColor || 'bg-stone-200 text-stone-700'}`}
                  >
                    {initial(m.name)}
                  </span>
                ))}
              </span>
              {members.length > 4 && (
                <span className="text-[12px] text-stone-400 font-medium">+{members.length - 4}</span>
              )}
            </>
          )}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: clean. (The component is not yet imported; that's fine — it compiles standalone.)

- [ ] **Step 3: Commit**

```bash
git add src/components/GoalCard.tsx
git commit -m "feat(goals): GoalCard component"
```

---

## Task 8: `NewGoalModal` component

**Files:**
- Create: `src/components/NewGoalModal.tsx`

A small modal with a single title input (visual language copied from `ContactModal`). Calls `onCreate(title)` and closes.

- [ ] **Step 1: Implement the component**

Create `src/components/NewGoalModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreate: (title: string) => void;
}

export default function NewGoalModal({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
          <h2 className="font-bold text-stone-900 text-lg">New goal</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Goal</label>
            <input
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
              placeholder="e.g. Break into VC"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <p className="text-[12px] text-stone-400 mt-1.5">We&apos;ll generate a photo for it automatically.</p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30">
              Create goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/NewGoalModal.tsx
git commit -m "feat(goals): NewGoalModal component"
```

---

## Task 9: `GoalDetailModal` component

**Files:**
- Create: `src/components/GoalDetailModal.tsx`

Shows the image (with Regenerate), an editable title, the member list (remove buttons), an "Add people" search over existing contacts, and Delete. Reads/writes via `useGoalsStore`; reads contacts from `useCRMStore`.

- [ ] **Step 1: Implement the component**

Create `src/components/GoalDetailModal.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { X, Trash2, RefreshCw, Plus } from 'lucide-react';
import { useGoalsStore } from '@/lib/goalsStore';
import { useCRMStore } from '@/lib/store';

interface Props {
  goalId: string;
  onClose: () => void;
}

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export default function GoalDetailModal({ goalId, onClose }: Props) {
  const goal = useGoalsStore((s) => s.goals.find((g) => g.id === goalId));
  const { renameGoal, deleteGoal, addMember, removeMember, regenerateImage } = useGoalsStore();
  const contacts = useCRMStore((s) => s.contacts);

  const [title, setTitle] = useState(goal?.title ?? '');
  const [query, setQuery] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const members = useMemo(
    () => (goal ? contacts.filter((c) => goal.memberIds.includes(c.id)) : []),
    [contacts, goal],
  );
  const candidates = useMemo(() => {
    if (!goal) return [];
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => !goal.memberIds.includes(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q))
      .slice(0, 6);
  }, [contacts, goal, query]);

  if (!goal) return null;

  function commitTitle() {
    const t = title.trim();
    if (t && t !== goal!.title) renameGoal(goal!.id, t);
  }
  async function onRegenerate() {
    setRegenerating(true);
    try { await regenerateImage(goal!.id); } finally { setRegenerating(false); }
  }
  function onDelete() {
    deleteGoal(goal!.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        {/* Image header */}
        <div className="relative h-40 w-full bg-gradient-to-br from-orange-100 via-amber-100 to-rose-100 flex items-center justify-center flex-shrink-0">
          {goal.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={goal.imageUrl} alt={goal.title} className="h-full w-full object-cover" />
          ) : regenerating ? (
            <span className="w-6 h-6 rounded-full border-2 border-orange-300 border-t-orange-500 animate-spin" />
          ) : (
            <span className="text-4xl font-bold text-orange-400/80">{initial(goal.title)}</span>
          )}
          <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/80 hover:bg-white text-stone-500 hover:text-stone-700 transition-colors">
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/85 hover:bg-white text-stone-600 text-[12px] font-semibold transition-colors disabled:opacity-60"
          >
            <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
            Regenerate
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Goal</label>
            <input
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-semibold text-stone-800 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </div>

          {/* Members */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">People ({members.length})</label>
            {members.length === 0 ? (
              <p className="text-sm text-stone-400 italic">No people yet — add some below.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-stone-100 text-stone-700 text-[13px]">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${m.avatarColor || 'bg-stone-200 text-stone-700'}`}>
                      {initial(m.name)}
                    </span>
                    {m.name}
                    <button onClick={() => removeMember(goal.id, m.id)} aria-label={`Remove ${m.name}`} className="p-0.5 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-600">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Add people — existing contacts only */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Add people</label>
            <input
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors"
              placeholder="Search your people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {candidates.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { addMember(goal.id, c.id); setQuery(''); }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-50 text-left transition-colors"
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${c.avatarColor || 'bg-stone-200 text-stone-700'}`}>
                      {initial(c.name)}
                    </span>
                    <span className="text-[13px] text-stone-700 flex-1 truncate">{c.name}{c.company ? <span className="text-stone-400"> · {c.company}</span> : null}</span>
                    <Plus size={14} className="text-stone-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={15} /> Delete
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-stone-700 hover:text-stone-900 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/GoalDetailModal.tsx
git commit -m "feat(goals): GoalDetailModal (image, title, members, add-people, delete)"
```

---

## Task 10: Goals rail on the Insights page

**Files:**
- Modify: `src/app/(app)/page.tsx`

Add a Goals section above "Your next moves", wiring `GoalCard`, `NewGoalModal`, and `GoalDetailModal` to `useGoalsStore` + `useCRMStore`.

- [ ] **Step 1: Add imports**

At the top of `src/app/(app)/page.tsx`, add to the imports:

```tsx
import { useGoalsStore } from '@/lib/goalsStore';
import GoalCard from '@/components/GoalCard';
import NewGoalModal from '@/components/NewGoalModal';
import GoalDetailModal from '@/components/GoalDetailModal';
import { Plus } from 'lucide-react';
```

(If `lucide-react` is already imported on one line, add `Plus` to that existing import instead of adding a second import line.)

- [ ] **Step 2: Read goals state + local UI state**

Inside `InsightsPage`, after the existing `const { contacts, loaded, saveDraft, markSent } = useCRMStore();` line, add:

```tsx
  const { goals, loaded: goalsLoaded, addGoal } = useGoalsStore();
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);
```

- [ ] **Step 3: Render the Goals section**

Inside the main white card, immediately AFTER the closing `</header>` (line ~90) and BEFORE the `{/* Upcoming … */}` block, insert:

```tsx
        {/* Goals — what you're pursuing, with the people tied to each */}
        <div className="flex-shrink-0 px-7 pt-5">
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-sm font-semibold text-stone-700">Goals</h2>
            {goalsLoaded && goals.length > 0 && (
              <span className="text-[12px] font-semibold text-stone-500 bg-stone-100 rounded-full px-2 py-0.5">{goals.length}</span>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                members={contacts.filter((c) => goal.memberIds.includes(c.id))}
                generating={!goal.imageUrl}
                onClick={() => setOpenGoalId(goal.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => setCreatingGoal(true)}
              className="w-[220px] flex-shrink-0 h-[180px] rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 hover:border-orange-300 hover:text-orange-500 transition flex flex-col items-center justify-center gap-2"
            >
              <Plus size={22} />
              <span className="text-[13px] font-semibold">New goal</span>
            </button>
          </div>
        </div>
```

- [ ] **Step 4: Render the modals**

Inside the closing fragment, after the existing `{composer.state && ( … )}` block and before `</>`, add:

```tsx
      {creatingGoal && (
        <NewGoalModal onClose={() => setCreatingGoal(false)} onCreate={(title) => addGoal(title)} />
      )}
      {openGoalId && (
        <GoalDetailModal goalId={openGoalId} onClose={() => setOpenGoalId(null)} />
      )}
```

- [ ] **Step 5: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat(goals): Goals rail + create/detail modals on Insights"
```

---

## Task 11: Goal membership in the person detail panel

**Files:**
- Modify: `src/components/ContactDetailPanel.tsx:147-152` (the Goals `Section`)

Replace the read-only `c.goal` text with chips of the goals the contact belongs to, plus a picker to toggle membership across existing goals only.

- [ ] **Step 1: Add imports + store hook**

At the top of `src/components/ContactDetailPanel.tsx`, add:

```tsx
import { useGoalsStore } from '@/lib/goalsStore';
```

Inside the component (find where `c` / the selected contact is available, near the top of the render body), add:

```tsx
  const { goals, addMember, removeMember } = useGoalsStore();
```

(If the component is split so the contact-rendering part is a child, place the hook in whichever component renders the Goals `Section` and has access to the contact `c`.)

- [ ] **Step 2: Replace the Goals section markup**

Replace the existing block (lines ~147-152):

```tsx
                {/* Goals */}
                <Section title="Goals">
                  {c.goal
                    ? <p className="text-sm text-stone-700 leading-relaxed">{c.goal}</p>
                    : <p className="text-sm text-stone-400 italic">Not set — add what you want from this person.</p>}
                </Section>
```

with:

```tsx
                {/* Goals — membership in existing goals (no free text) */}
                <Section title="Goals">
                  {goals.length === 0 ? (
                    <p className="text-sm text-stone-400 italic">No goals yet — create one on the Insights page.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {goals.map((g) => {
                        const active = g.memberIds.includes(c.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => (active ? removeMember(g.id, c.id) : addMember(g.id, c.id))}
                            aria-pressed={active}
                            className={`px-2.5 py-1 rounded-full text-[13px] font-medium border transition-colors ${
                              active
                                ? 'bg-orange-500 border-orange-500 text-white'
                                : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-100'
                            }`}
                          >
                            {g.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Section>
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Run the full suite**

Run: `npm run test && npm run lint`
Expected: all PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/ContactDetailPanel.tsx
git commit -m "feat(goals): goal-membership picker in contact detail panel"
```

---

## Task 12: Manual acceptance

**Prereqs:** run `docs/superpowers/sql/2026-06-15-goals-table.sql` in the Supabase SQL editor; confirm `POLLINATIONS_API_KEY` is in `.env.local`; `npm run dev`.

- [ ] **Step 1:** On Insights, click **New goal**, enter a title, Create. The card appears immediately with a spinner; within a few seconds the AI image loads. (If no image appears, check the dev server logs for `generateGoalImage failed` — confirm the upload-response shape against `parseUploadedUrl`; the goal still works imageless.)
- [ ] **Step 2:** Open the goal → **Regenerate** swaps the image. Rename the title; reopen to confirm it persisted.
- [ ] **Step 3:** In the goal, **Add people** — the search lists only existing contacts. Add two, remove one. Member avatars update on the card.
- [ ] **Step 4:** Open a person's detail panel → the **Goals** section shows goal chips; toggling adds/removes membership (reflected on the goal card).
- [ ] **Step 5:** Open **Add Person** — confirm there is no free-text Goals field.
- [ ] **Step 6:** Draft a message for a goal member (Insights → a move's "Draft message") — the AI context still reflects the goal title. Confirm Chat and the Dashboard board/table are unaffected.
- [ ] **Step 7:** Reload the page — goals, images, and memberships persist.

---

## Self-review notes

- **Spec coverage:** table (Task 1) · actions CRUD+members (Task 2) · AI image server-side + key-free re-host + env (Task 3) · store with background image + regenerate (Task 4) · derived read-only `contact.goal` + goal hydration (Task 5) · remove open-ended field (Task 6) · Insights rail + create/detail modals (Tasks 7-10) · person-side existing-goals picker (Task 11) · acceptance incl. AI-context check (Task 12). All spec sections map to a task.
- **Type consistency:** `Goal` (`imageUrl`, `memberIds`) defined in Task 1 and used unchanged through actions/store/UI. Store methods: `addGoal`, `renameGoal`, `deleteGoal`, `addMember`, `removeMember`, `regenerateImage`, `setGoals` — referenced consistently in Tasks 9-11. Action names (`addGoalMember`/`removeGoalMember`/`generateGoalImage`/`updateGoal`) match between Tasks 2-4 and the store.
- **Known external unknown:** the exact JSON shape of `media.pollinations.ai/upload` — handled defensively by `parseUploadedUrl` (accepts `url`/`hash`/`cid`) and a null-safe failure path; verified live in Task 12 Step 1.
