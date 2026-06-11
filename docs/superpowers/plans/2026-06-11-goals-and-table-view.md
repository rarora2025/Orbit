# Goals + Table View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-user Goals system and a spreadsheet-style Table view of contacts to the Orbit CRM, while collapsing the `Contact` model's overlapping "why I care" fields into one `goal` and removing `priority` in favor of the existing temperature rating.

**Architecture:** Goals live in a new relational Supabase `goals` table, reached through `userId`-scoped server actions and an optimistic Zustand store hydrated on load (mirrors the existing `contacts`/`chats` patterns). The Dashboard gains a Board/Table toggle; both views render from the single `useCRMStore`, so an edit in either (or in the detail panel) is reflected everywhere. The table supports inline edit of status/temperature/goal, client-side sort and search, and opens the existing detail panel on row click.

**Tech Stack:** Next.js (modified 16.x) App Router, React, TypeScript, Zustand, Supabase (service-role, server-only), Clerk auth, Tailwind, Vitest, lucide-react.

---

## Reference reading (before you start)

- This repo runs a **modified Next.js** — see `AGENTS.md`. You are not adding new routing/server primitives here (server actions and the `(app)` route group already exist), but if anything about server actions or route files surprises you, read the relevant guide under `node_modules/next/dist/docs/` first.
- Existing patterns to imitate exactly:
  - Server actions + `userId` scoping: `src/lib/contacts.actions.ts`, `src/lib/chats.actions.ts`.
  - Server-action tests (Supabase + Clerk mocked): `src/lib/chats.actions.test.ts`, `src/lib/contacts.actions.test.ts`.
  - Zustand store with optimistic + server-backed mutations: `src/lib/store.ts`, plus its test `src/lib/store.test.ts`.
  - Hydration on mount: `src/components/StoreHydrator.tsx`.
- Run the whole suite with `npm run test`; lint with `npm run lint`. Both must be green at every commit.

---

## File Structure

**Create:**
- `src/lib/goals.actions.ts` — `userId`-scoped CRUD server actions for the `goals` table; exports the `Goal` type.
- `src/lib/goals.actions.test.ts` — scoping/CRUD tests, mirroring `chats.actions.test.ts`.
- `src/lib/goalsStore.ts` — Zustand store: in-memory goals, optimistic + server-backed mutations.
- `src/lib/goalsStore.test.ts` — reducer tests (hydrate + optimistic apply), mirroring `store.test.ts`.
- `src/lib/tableView.ts` — pure `searchContacts` + `sortContacts` helpers for the table.
- `src/lib/tableView.test.ts` — tests for those helpers.
- `src/app/(app)/goals/page.tsx` — the Goals page (list / create / edit / archive).

**Modify:**
- `src/lib/mockData.ts` — drop `inquiry`; rename `relationshipGoal` → `goal`; remove `priority` field and the `Priority` type.
- `src/lib/contacts.actions.ts` — `rowToContact` read-time back-compat for `goal`.
- `src/lib/utils.ts` — remove `getPriorityColor`, `getPriorityIcon`, and the `Priority` import.
- `src/lib/draftMessage.ts` — read `contact.goal`.
- `src/lib/ai.actions.ts` — read `contact.goal`.
- `src/components/ContactModal.tsx` — `goal` form key; drop `inquiry`/`priority` initializers; feed goal titles into the datalist.
- `src/components/ContactDetailPanel.tsx` — show + inline-edit `c.goal`; offer existing goal titles.
- `src/components/ContactTable.tsx` — full rewrite (new columns, inline edit, sort, search).
- `src/components/Sidebar.tsx` — add a Goals nav item.
- `src/components/StoreHydrator.tsx` — hydrate the goals store.
- `src/app/(app)/dashboard/page.tsx` — Board/Table toggle.
- Test fixtures that reference the dropped/renamed fields: `src/lib/store.test.ts`, `src/lib/contactDerive.test.ts`, `src/lib/contactSearch.test.ts`, `src/lib/nextMoves.test.ts`, `src/lib/draftMessage.test.ts`.

**Delete:**
- `src/components/PriorityBadge.tsx`.

---

## Task 1: Contact model cleanup — types + back-compat + consumers

Collapse `inquiry` + `relationshipGoal` into `goal`, remove `priority`. Done as one task because the type change and its consumers must move together to keep the build/tests green.

**Files:**
- Modify: `src/lib/mockData.ts:9`, `src/lib/mockData.ts:35`, `src/lib/mockData.ts:39-40`
- Modify: `src/lib/contacts.actions.ts:15-18`
- Modify: `src/lib/utils.ts:1`, `src/lib/utils.ts:23-41`
- Modify: `src/lib/draftMessage.ts:15`
- Modify: `src/lib/ai.actions.ts:67`
- Modify: `src/components/ContactModal.tsx`
- Modify: `src/components/ContactDetailPanel.tsx:119-122`
- Delete: `src/components/PriorityBadge.tsx`
- Modify (test fixtures): `src/lib/store.test.ts:26`, `src/lib/contactDerive.test.ts:8`, `src/lib/contactSearch.test.ts:14-18,61-64`, `src/lib/nextMoves.test.ts:13-17`, `src/lib/draftMessage.test.ts:8-11,31-32`

- [ ] **Step 1: Update the `Contact` type and remove `Priority`**

In `src/lib/mockData.ts`, delete the `Priority` type (line 9) entirely:

```ts
// DELETE this line:
export type Priority = 'Low' | 'Medium' | 'High' | 'Dream';
```

In the `Contact` interface: remove the `inquiry: string;` line, remove the `priority: Priority;` line, and rename `relationshipGoal` to `goal`:

```ts
  email: string;
  notes: string;
  status: Status;
  /** What the user wants from this person — also the title of a Goal, when picked. */
  goal?: string;
  score: number;
  warmth: Warmth;
```

- [ ] **Step 2: Add read-time back-compat in `rowToContact`**

In `src/lib/contacts.actions.ts`, replace `rowToContact` (lines 15-18) so old rows that stored `relationshipGoal` still surface as `goal`, and the dropped keys are discarded:

```ts
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
```

- [ ] **Step 3: Remove the priority helpers from `utils.ts`**

In `src/lib/utils.ts`, change the import on line 1 to drop `Priority`:

```ts
import { Status } from './mockData';
```

Delete the `getPriorityColor` and `getPriorityIcon` functions (lines 23-41) entirely. Leave everything else.

- [ ] **Step 4: Delete `PriorityBadge.tsx`**

```bash
git rm src/components/PriorityBadge.tsx
```

- [ ] **Step 5: Update `draftMessage.ts` and `ai.actions.ts` to read `goal`**

In `src/lib/draftMessage.ts:15`:

```ts
  const goal = contact.goal?.trim();
```

In `src/lib/ai.actions.ts:67`:

```ts
    contact.goal ? `My goal with this relationship: ${contact.goal}.` : '',
```

- [ ] **Step 6: Update `ContactModal.tsx`**

In `src/components/ContactModal.tsx`:
- In the `useState` form initializer (line 37), rename the key:

```ts
    goal: contact?.goal ?? '',
```

- In the edit-mode `onSave` payload (line 58), rename:

```ts
        goal: form.goal.trim(),
```

- In the new-contact object (lines 78-92), remove the `inquiry: ''` line and the `priority: 'Medium',` line, and rename `relationshipGoal` → `goal`:

```ts
      goal: form.goal.trim(),
```

- In the "Goals" field JSX (lines 169-175), bind to `form.goal`:

```ts
              value={form.goal}
              onChange={e => handleChange('goal', e.target.value)}
```

(The static `GOAL_SUGGESTIONS` datalist stays for now; Task 5 feeds it real goal titles.)

- [ ] **Step 7: Update the detail panel's Goals section**

In `src/components/ContactDetailPanel.tsx` (lines 119-122), read `c.goal` (inline editing comes in Task 5):

```tsx
                  {c.goal
                    ? <p className="text-sm text-stone-700 leading-relaxed">{c.goal}</p>
                    : <p className="text-sm text-stone-400 italic">Not set — add what you want from this person.</p>}
```

- [ ] **Step 8: Fix test fixtures**

`src/lib/store.test.ts:26` — remove `inquiry: '',` and `priority: 'Medium',`:

```ts
    notes: '', status, score: 0, warmth: 'Medium',
```

`src/lib/contactDerive.test.ts:8` — remove `inquiry: '',` and `priority: 'Medium',`.

`src/lib/nextMoves.test.ts` — remove the `inquiry: ''` line (≈13) and the `priority: 'Medium',` line (≈15).

`src/lib/draftMessage.test.ts` — in `makeContact` (lines 8-11) remove `inquiry: ''` and `priority: 'Medium',`, and rename `relationshipGoal:` → `goal:`. In the test at line 31-32 rename the override:

```ts
    const msg = generateDraftMessage(makeContact({ goal: 'sports betting products' }), 'Casual', 'Email');
```

`src/lib/contactSearch.test.ts` — in `makeContact` remove `inquiry: 'a secret inquiry',` (line 14) and `priority: 'Medium',` (line 17). In the "out of scope" test (lines 61-64) drop the now-meaningless `'secret'` assertion, keeping the notes one:

```ts
  it('does not match free-text fields that are out of scope', () => {
    expect(filterContacts(contacts, 'private')).toEqual([]);
  });
```

- [ ] **Step 9: Run the suite and lint**

Run: `npm run test`
Expected: PASS (all suites green; no references to `inquiry`/`priority`/`relationshipGoal` remain).

Run: `npm run lint`
Expected: no errors.

If TypeScript flags a stray `relationshipGoal`/`inquiry`/`priority` anywhere, grep for it and fix — there should be none outside what's listed.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: collapse inquiry/relationshipGoal into goal, drop priority"
```

---

## Task 2: Goals server actions + table

**Files:**
- Create: `src/lib/goals.actions.ts`
- Create: `src/lib/goals.actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/goals.actions.test.ts` (mirrors `chats.actions.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const del = vi.fn();
const single = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ data: [], error: null });
  single.mockResolvedValue({ data: { id: 'g1', title: 'T', description: '', status: 'active', created_at: '2026-06-11T00:00:00Z', updated_at: '2026-06-11T00:00:00Z' }, error: null });
  eq.mockReturnValue({ order, eq, select });
  select.mockReturnValue({ eq, order, single });
  insert.mockReturnValue({ select });
  update.mockReturnValue({ eq });
  del.mockReturnValue({ eq });
  from.mockReturnValue({ select, insert, update, delete: del });
});

describe('listGoals', () => {
  it('throws when there is no signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { listGoals } = await import('./goals.actions');
    await expect(listGoals()).rejects.toThrow(/auth/i);
  });

  it('scopes the read to the Clerk userId', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { listGoals } = await import('./goals.actions');
    await listGoals();
    expect(from).toHaveBeenCalledWith('goals');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
  });
});

describe('addGoal', () => {
  it('inserts a row carrying the userId and title', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { addGoal } = await import('./goals.actions');
    await addGoal({ title: 'Recruiting', description: '' });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user_123', title: 'Recruiting' }),
    );
  });
});

describe('updateGoal', () => {
  it('scopes the update to the userId and the id', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { updateGoal } = await import('./goals.actions');
    await updateGoal('g1', { status: 'archived' });
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 'g1');
  });
});

describe('deleteGoal', () => {
  it('scopes the delete to the userId and the id', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { deleteGoal } = await import('./goals.actions');
    await deleteGoal('g1');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 'g1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- goals.actions`
Expected: FAIL — `Cannot find module './goals.actions'`.

- [ ] **Step 3: Implement `goals.actions.ts`**

Create `src/lib/goals.actions.ts`:

```ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

interface Row {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToGoal(r: Row): Goal {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    status: r.status === 'archived' ? 'archived' : 'active',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

const COLS = 'id, title, description, status, created_at, updated_at';

export async function listGoals(): Promise<Goal[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('goals')
    .select(COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(rowToGoal);
}

export async function addGoal(input: { title: string; description?: string }): Promise<Goal> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('goals')
    .insert({ user_id: userId, title: input.title, description: input.description ?? '', status: 'active' })
    .select(COLS)
    .single();
  if (error) throw error;
  return rowToGoal(data as Row);
}

export async function updateGoal(
  id: string,
  updates: Partial<Pick<Goal, 'title' | 'description' | 'status'>>,
): Promise<Goal> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select(COLS)
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
```

Note: the test's `update.mockReturnValue({ eq })` returns an object whose `eq` is the shared `eq` mock; the second `.eq(...)` returns `{ order, eq, select }`, and `.select(COLS).single()` resolves via the `single` mock. This matches the chained-builder mocking style already used in the repo.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- goals.actions`
Expected: PASS (all four describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/goals.actions.ts src/lib/goals.actions.test.ts
git commit -m "feat: goals server actions (userId-scoped CRUD)"
```

---

## Task 3: Goals store + hydration

**Files:**
- Create: `src/lib/goalsStore.ts`
- Create: `src/lib/goalsStore.test.ts`
- Modify: `src/components/StoreHydrator.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/lib/goalsStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./goals.actions', () => ({
  listGoals: vi.fn(),
  addGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
}));

import { useGoalsStore } from './goalsStore';
import type { Goal } from './goals.actions';
import * as api from './goals.actions';

function g(id: string, title: string, status: Goal['status'] = 'active'): Goal {
  return { id, title, description: '', status, created_at: '2026-06-11T00:00:00Z', updated_at: '2026-06-11T00:00:00Z' };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGoalsStore.setState({ goals: [], loaded: false });
});

describe('useGoalsStore', () => {
  it('setGoals stores goals and marks loaded', () => {
    useGoalsStore.getState().setGoals([g('1', 'Recruiting')]);
    expect(useGoalsStore.getState().goals).toHaveLength(1);
    expect(useGoalsStore.getState().loaded).toBe(true);
  });

  it('addGoal appends the returned goal', async () => {
    (api.addGoal as ReturnType<typeof vi.fn>).mockResolvedValue(g('2', 'Tutoring'));
    await useGoalsStore.getState().addGoal({ title: 'Tutoring' });
    expect(useGoalsStore.getState().goals.map((x) => x.id)).toEqual(['2']);
  });

  it('updateGoal replaces the matching goal', async () => {
    useGoalsStore.setState({ goals: [g('1', 'Old')], loaded: true });
    (api.updateGoal as ReturnType<typeof vi.fn>).mockResolvedValue(g('1', 'New'));
    await useGoalsStore.getState().updateGoal('1', { title: 'New' });
    expect(useGoalsStore.getState().goals.find((x) => x.id === '1')?.title).toBe('New');
  });

  it('deleteGoal removes the goal', async () => {
    useGoalsStore.setState({ goals: [g('1', 'X')], loaded: true });
    (api.deleteGoal as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await useGoalsStore.getState().deleteGoal('1');
    expect(useGoalsStore.getState().goals).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- goalsStore`
Expected: FAIL — `Cannot find module './goalsStore'`.

- [ ] **Step 3: Implement `goalsStore.ts`**

Create `src/lib/goalsStore.ts` (mirrors `store.ts`):

```ts
'use client';

import { create } from 'zustand';
import type { Goal } from './goals.actions';
import * as api from './goals.actions';

interface GoalsStore {
  goals: Goal[];
  loaded: boolean;
  setGoals: (goals: Goal[]) => void;
  addGoal: (input: { title: string; description?: string }) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Pick<Goal, 'title' | 'description' | 'status'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

export const useGoalsStore = create<GoalsStore>()((set) => {
  const upsertLocal = (goal: Goal) =>
    set((s) => ({ goals: [...s.goals.filter((g) => g.id !== goal.id), goal] }));

  return {
    goals: [],
    loaded: false,
    setGoals: (goals) => set({ goals, loaded: true }),
    addGoal: async (input) => { upsertLocal(await api.addGoal(input)); },
    updateGoal: async (id, updates) => { upsertLocal(await api.updateGoal(id, updates)); },
    deleteGoal: async (id) => {
      await api.deleteGoal(id);
      set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    },
  };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- goalsStore`
Expected: PASS.

- [ ] **Step 5: Hydrate goals on mount**

In `src/components/StoreHydrator.tsx`, add the goals store and its loader:

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

- [ ] **Step 6: Run the suite + lint, then commit**

Run: `npm run test` → PASS. Run: `npm run lint` → clean.

```bash
git add src/lib/goalsStore.ts src/lib/goalsStore.test.ts src/components/StoreHydrator.tsx
git commit -m "feat: goals store + hydration on mount"
```

---

## Task 4: Goals page + sidebar nav

**Files:**
- Create: `src/app/(app)/goals/page.tsx`
- Modify: `src/components/Sidebar.tsx:5`, `src/components/Sidebar.tsx:9-13`

No new pure logic here, so no unit test; verification is manual (the page renders, CRUD round-trips). Keep styling consistent with the Orbit look (white cards, orange accent, subtle stone borders, rounded-3xl container like the dashboard).

- [ ] **Step 1: Add the Goals nav item**

In `src/components/Sidebar.tsx`, add `Target` to the lucide import (line 5):

```ts
import { LayoutGrid, MessageCircle, Compass, Target } from 'lucide-react';
```

Add a 4th nav entry (lines 9-13):

```ts
const navItems = [
  { href: '/',          icon: Compass,       label: 'Insights'  },
  { href: '/chat',      icon: MessageCircle, label: 'Chat'      },
  { href: '/dashboard', icon: LayoutGrid,    label: 'Dashboard' },
  { href: '/goals',     icon: Target,        label: 'Goals'     },
];
```

- [ ] **Step 2: Create the Goals page**

Create `src/app/(app)/goals/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useGoalsStore } from '@/lib/goalsStore';
import { Plus, Pencil, Archive, Trash2, X, Check } from 'lucide-react';

export default function GoalsPage() {
  const { goals, loaded, addGoal, updateGoal, deleteGoal } = useGoalsStore();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const active = goals.filter((g) => g.status === 'active');

  if (!loaded) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="flex items-center gap-2 text-stone-400 text-sm">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-orange-400 animate-spin" />
          Loading your goals…
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40 overflow-hidden">
      <header className="flex-shrink-0 flex items-center justify-between px-7 pt-5 pb-4 border-b border-stone-100">
        <h1 className="text-lg font-bold text-stone-900 tracking-tight">Goals</h1>
        <button
          onClick={() => { setCreating(true); setEditingId(null); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-white bg-orange-500 rounded-full shadow-sm shadow-orange-500/30 hover:bg-orange-600 transition active:scale-95"
        >
          <Plus size={15} /> New goal
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-7 py-5">
        {creating && (
          <GoalForm
            onCancel={() => setCreating(false)}
            onSave={async (title, description) => { await addGoal({ title, description }); setCreating(false); }}
          />
        )}

        {active.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <p className="text-base font-semibold text-stone-800">No goals yet</p>
            <p className="text-sm text-stone-400 mt-1 max-w-xs">
              Add a goal like “Recruiting” or “Meet prediction market founders”, then tag the people who help you reach it.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((goal) =>
              editingId === goal.id ? (
                <GoalForm
                  key={goal.id}
                  initialTitle={goal.title}
                  initialDescription={goal.description}
                  onCancel={() => setEditingId(null)}
                  onSave={async (title, description) => { await updateGoal(goal.id, { title, description }); setEditingId(null); }}
                />
              ) : (
                <div key={goal.id} className="group rounded-2xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-[15px] font-semibold text-stone-800 leading-snug">{goal.title}</h2>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(goal.id); setCreating(false); }} aria-label="Edit goal" className="p-1.5 rounded-lg text-stone-400 hover:bg-orange-50 hover:text-orange-500 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => updateGoal(goal.id, { status: 'archived' })} aria-label="Archive goal" className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
                        <Archive size={14} />
                      </button>
                      <button onClick={() => deleteGoal(goal.id)} aria-label="Delete goal" className="p-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {goal.description && (
                    <p className="text-[13px] text-stone-500 leading-relaxed mt-1.5">{goal.description}</p>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalForm({
  initialTitle = '', initialDescription = '', onSave, onCancel,
}: {
  initialTitle?: string;
  initialDescription?: string;
  onSave: (title: string, description: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const input = 'w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (title.trim()) onSave(title.trim(), description.trim()); }}
      className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 mb-3 space-y-2.5"
    >
      <input className={input} autoFocus placeholder="Goal title (e.g. Recruiting)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={input} placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium text-stone-600 hover:text-stone-800 transition-colors">
          <X size={14} /> Cancel
        </button>
        <button type="submit" className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-orange-500 text-white text-[13px] font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95">
          <Check size={14} /> Save
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Lint, then verify the route compiles**

Run: `npm run lint` → clean.
Run: `npm run build` (or start the dev server) to confirm `/goals` compiles. Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/goals/page.tsx src/components/Sidebar.tsx
git commit -m "feat: goals page + sidebar nav"
```

---

## Task 5: Link contacts to goals (datalist + inline detail edit)

Feed the user's real goal titles into the contact modal's datalist, and make the detail panel's Goals section inline-editable with the same suggestions.

**Files:**
- Modify: `src/components/ContactModal.tsx:25-29,166-179`
- Modify: `src/components/ContactDetailPanel.tsx`

- [ ] **Step 1: Feed real goal titles into the modal datalist**

In `src/components/ContactModal.tsx`, import the goals store at the top:

```ts
import { useGoalsStore } from '@/lib/goalsStore';
```

Inside the component, read active goal titles and merge with the static suggestions (keep the static ones as a fallback for empty accounts):

```ts
  const goalTitles = useGoalsStore((s) => s.goals.filter((g) => g.status === 'active').map((g) => g.title));
  const suggestions = Array.from(new Set([...goalTitles, ...GOAL_SUGGESTIONS]));
```

Render `suggestions` in the datalist (replace the `GOAL_SUGGESTIONS.map(...)` at lines 176-178):

```tsx
            <datalist id="relationship-goals">
              {suggestions.map(g => <option key={g} value={g} />)}
            </datalist>
```

- [ ] **Step 2: Make the detail panel Goals section inline-editable**

In `src/components/ContactDetailPanel.tsx`, the panel currently receives a `contact` and an `onEdit` callback but no field-update path. Add an `onUpdateGoal` prop and an inline editor.

Add to the `Props` interface:

```ts
  onUpdateGoal: (id: string, goal: string) => void;
```

Add the goals store import and the lucide `Check`/`X` icons (extend the existing import line 7):

```ts
import { X, Pencil, Star, Mail, Link2, ExternalLink, Clock, Check } from 'lucide-react';
import { useGoalsStore } from '@/lib/goalsStore';
```

Replace the Goals `<Section>` (lines 117-122) with an editable version. Add this local state near the top of the component body (after `const open = ...`):

```tsx
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const goalTitles = useGoalsStore((s) => s.goals.filter((g) => g.status === 'active').map((g) => g.title));
```

Goals section JSX:

```tsx
                <Section title="Goals">
                  {editingGoal ? (
                    <div className="space-y-2">
                      <input
                        autoFocus
                        list="detail-goal-suggestions"
                        value={goalDraft}
                        onChange={(e) => setGoalDraft(e.target.value)}
                        placeholder="What do you want from this person?"
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
                      />
                      <datalist id="detail-goal-suggestions">
                        {goalTitles.map((g) => <option key={g} value={g} />)}
                      </datalist>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { onUpdateGoal(c.id, goalDraft.trim()); setEditingGoal(false); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-[13px] font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95"
                        >
                          <Check size={13} /> Save
                        </button>
                        <button type="button" onClick={() => setEditingGoal(false)} className={STONE_OUTLINE_BTN}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group flex items-start justify-between gap-2">
                      {c.goal
                        ? <p className="text-sm text-stone-700 leading-relaxed">{c.goal}</p>
                        : <p className="text-sm text-stone-400 italic">Not set — add what you want from this person.</p>}
                      <button
                        type="button"
                        onClick={() => { setGoalDraft(c.goal ?? ''); setEditingGoal(true); }}
                        aria-label="Edit goal"
                        className="p-1 rounded-lg text-stone-400 hover:bg-orange-50 hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </Section>
```

(`STONE_OUTLINE_BTN` is already defined at the top of the file.)

- [ ] **Step 3: Wire `onUpdateGoal` from the dashboard**

In `src/app/(app)/dashboard/page.tsx`, pass the new prop to `<ContactDetailPanel>` (it already destructures `updateContact` from the store):

```tsx
        onUpdateGoal={(id, goal) => updateContact(id, { goal })}
```

- [ ] **Step 4: Lint + verify compile, then commit**

Run: `npm run lint` → clean. Confirm the app builds/compiles.

```bash
git add src/components/ContactModal.tsx src/components/ContactDetailPanel.tsx "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: pick existing goals on contacts + inline goal edit in detail panel"
```

---

## Task 6: Table sort + search helpers

**Files:**
- Create: `src/lib/tableView.ts`
- Create: `src/lib/tableView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/tableView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { searchContacts, sortContacts } from './tableView';
import type { Contact } from './mockData';

function c(over: Partial<Contact>): Contact {
  return {
    id: '1', position: 0, name: 'Jane Doe', company: 'Acme', role: 'Eng',
    linkedinUrl: '', email: '', notes: '', status: 'Send', score: 0, warmth: 'Medium',
    avatarColor: '', tags: [], lastContacted: '', nextAction: '', aiSummary: '',
    outreachAngle: '', suggestedMessage: '', interactions: [], ...over,
  };
}

describe('searchContacts', () => {
  const list = [
    c({ id: '1', name: 'Ali Hirsa', company: 'Columbia', goal: 'Tutoring', notes: 'met at talk' }),
    c({ id: '2', name: 'Shayne Coplan', company: 'Polymarket', goal: 'Investor' }),
  ];

  it('returns all for an empty/whitespace query', () => {
    expect(searchContacts(list, '')).toBe(list);
    expect(searchContacts(list, '   ')).toBe(list);
  });

  it('matches name, company, goal, and notes (case-insensitive)', () => {
    expect(searchContacts(list, 'HIRSA').map((x) => x.id)).toEqual(['1']);
    expect(searchContacts(list, 'polymarket').map((x) => x.id)).toEqual(['2']);
    expect(searchContacts(list, 'investor').map((x) => x.id)).toEqual(['2']);
    expect(searchContacts(list, 'talk').map((x) => x.id)).toEqual(['1']);
  });
});

describe('sortContacts', () => {
  it('sorts by status using the board order', () => {
    const list = [c({ id: 'a', status: 'Met' }), c({ id: 'b', status: 'Send' })];
    expect(sortContacts(list, 'status', 'asc').map((x) => x.id)).toEqual(['b', 'a']);
    expect(sortContacts(list, 'status', 'desc').map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('sorts by temperature Low<Medium<High', () => {
    const list = [c({ id: 'a', warmth: 'High' }), c({ id: 'b', warmth: 'Low' })];
    expect(sortContacts(list, 'temperature', 'asc').map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('sorts by date and always puts unset dates last', () => {
    const list = [
      c({ id: 'a', nextFollowUpAt: undefined }),
      c({ id: 'b', nextFollowUpAt: '2026-07-01' }),
      c({ id: 'c', nextFollowUpAt: '2026-06-15' }),
    ];
    expect(sortContacts(list, 'nextFollowUpAt', 'asc').map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(sortContacts(list, 'nextFollowUpAt', 'desc').map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tableView`
Expected: FAIL — `Cannot find module './tableView'`.

- [ ] **Step 3: Implement `tableView.ts`**

Create `src/lib/tableView.ts`:

```ts
import type { Contact } from './mockData';
import { BOARD_STATUSES } from './mockData';

export type SortKey = 'status' | 'temperature' | 'lastContacted' | 'nextFollowUpAt';
export type SortDir = 'asc' | 'desc';

const WARMTH_RANK: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

export function searchContacts(contacts: Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter((c) =>
    [c.name, c.company, c.goal ?? '', c.notes].some((f) => f.toLowerCase().includes(q)),
  );
}

/** Parse to epoch ms; empty/invalid → null (always sorted last, regardless of dir). */
function dateValue(s?: string): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

function compareDates(a: string | undefined, b: string | undefined, sign: number): number {
  const av = dateValue(a);
  const bv = dateValue(b);
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  return sign * (av - bv);
}

export function sortContacts(contacts: Contact[], key: SortKey, dir: SortDir): Contact[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...contacts].sort((a, b) => {
    switch (key) {
      case 'status':
        return sign * (BOARD_STATUSES.indexOf(a.status) - BOARD_STATUSES.indexOf(b.status));
      case 'temperature':
        return sign * (WARMTH_RANK[a.warmth] - WARMTH_RANK[b.warmth]);
      case 'lastContacted':
        return compareDates(a.lastContacted, b.lastContacted, sign);
      case 'nextFollowUpAt':
        return compareDates(a.nextFollowUpAt, b.nextFollowUpAt, sign);
    }
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tableView`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tableView.ts src/lib/tableView.test.ts
git commit -m "feat: table sort + search helpers"
```

---

## Task 7: Rewrite `ContactTable` (columns + inline edit + sort/search)

The current `ContactTable.tsx` is dead code (no live importer); replace it entirely. No unit test for the component itself; the sort/search logic is already tested in Task 6, and behavior is verified manually in Task 8.

**Files:**
- Modify (full rewrite): `src/components/ContactTable.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `src/components/ContactTable.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Contact, Status, BOARD_STATUSES, columnConfig } from '@/lib/mockData';
import { formatDate } from '@/lib/utils';
import { searchContacts, sortContacts, type SortKey, type SortDir } from '@/lib/tableView';
import { companyDisplayName } from '@/lib/companyLogo';
import { Search, ArrowUp, ArrowDown, Star } from 'lucide-react';

interface Props {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Inline status change — routed through the store's moveContact for board ordering. */
  onChangeStatus: (id: string, status: Status) => void;
  onChangeWarmth: (id: string, warmth: Contact['warmth']) => void;
  onChangeGoal: (id: string, goal: string) => void;
}

const WARMTH_BY_LEVEL: Record<number, Contact['warmth']> = { 1: 'Low', 2: 'Medium', 3: 'High' };
const WARMTH_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

const SORTABLE: { key: SortKey; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'lastContacted', label: 'Last Contacted' },
  { key: 'nextFollowUpAt', label: 'Next Follow-up' },
];

export default function ContactTable({
  contacts, selectedId, onSelect, onChangeStatus, onChangeWarmth, onChangeGoal,
}: Props) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const rows = useMemo(
    () => sortContacts(searchContacts(contacts, query), sortKey, sortDir),
    [contacts, query, sortKey, sortDir],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sortableHeader = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 hover:text-stone-600 transition-colors"
    >
      {label}
      {sortKey === key && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </button>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-stone-100">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, goal, notes…"
            className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full min-w-[940px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-stone-50/95 backdrop-blur border-b border-stone-200/70 text-left text-[12px] font-semibold text-stone-400 uppercase tracking-wider">
              <th className="px-4 py-2.5">Person</th>
              <th className="px-4 py-2.5">{sortableHeader('status', 'Status')}</th>
              <th className="px-4 py-2.5">{sortableHeader('temperature', 'Temperature')}</th>
              <th className="px-4 py-2.5">Goal</th>
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">{sortableHeader('lastContacted', 'Last Contacted')}</th>
              <th className="px-4 py-2.5">{sortableHeader('nextFollowUpAt', 'Next Follow-up')}</th>
              <th className="px-4 py-2.5">Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-stone-400">
                  No contacts match.
                </td>
              </tr>
            ) : rows.map((contact) => (
              <Row
                key={contact.id}
                contact={contact}
                selected={selectedId === contact.id}
                onSelect={() => onSelect(contact.id)}
                onChangeStatus={(s) => onChangeStatus(contact.id, s)}
                onChangeWarmth={(w) => onChangeWarmth(contact.id, w)}
                onChangeGoal={(g) => onChangeGoal(contact.id, g)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  contact, selected, onSelect, onChangeStatus, onChangeWarmth, onChangeGoal,
}: {
  contact: Contact;
  selected: boolean;
  onSelect: () => void;
  onChangeStatus: (s: Status) => void;
  onChangeWarmth: (w: Contact['warmth']) => void;
  onChangeGoal: (g: string) => void;
}) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(contact.goal ?? '');
  const cfg = columnConfig[contact.status] ?? { dot: 'bg-stone-400', bg: 'bg-stone-100', text: 'text-stone-600' };
  const level = WARMTH_LEVEL[contact.warmth] ?? 1;
  const companyLabel = companyDisplayName(contact.company);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <tr
      onClick={onSelect}
      className={`group cursor-pointer border-b border-stone-100 last:border-0 transition-colors ${
        selected ? 'bg-orange-50/70' : 'hover:bg-stone-50/70'
      }`}
    >
      {/* Person */}
      <td className="px-4 py-3 relative">
        {selected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-orange-400 rounded-r" />}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 flex items-center justify-center text-[13px] font-bold flex-shrink-0">
            {contact.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-stone-800 leading-tight truncate">{contact.name}</p>
            <p className="text-[13px] text-stone-400 truncate">{contact.role || '—'}</p>
          </div>
        </div>
      </td>

      {/* Status — inline dropdown */}
      <td className="px-4 py-3" onClick={stop}>
        <div className="relative inline-flex items-center">
          <span className={`pointer-events-none inline-flex items-center gap-1.5 rounded-full pl-2 pr-6 py-1 ${cfg.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            <span className={`text-[12px] font-semibold ${cfg.text}`}>{contact.status}</span>
          </span>
          <select
            value={contact.status}
            onChange={(e) => onChangeStatus(e.target.value as Status)}
            aria-label="Change status"
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          >
            {BOARD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </td>

      {/* Temperature — 3 stars */}
      <td className="px-4 py-3" onClick={stop}>
        <div className="inline-flex items-center gap-0.5">
          {[1, 2, 3].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChangeWarmth(WARMTH_BY_LEVEL[i])}
              aria-label={`Set temperature ${i}`}
              className="p-0.5"
            >
              <Star size={14} className={i <= level ? 'fill-orange-400 text-orange-400' : 'fill-stone-100 text-stone-300 hover:text-stone-400'} />
            </button>
          ))}
        </div>
      </td>

      {/* Goal — inline editable text */}
      <td className="px-4 py-3 max-w-[200px]" onClick={stop}>
        {editingGoal ? (
          <input
            autoFocus
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            onBlur={() => { onChangeGoal(goalDraft.trim()); setEditingGoal(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onChangeGoal(goalDraft.trim()); setEditingGoal(false); }
              if (e.key === 'Escape') { setGoalDraft(contact.goal ?? ''); setEditingGoal(false); }
            }}
            className="w-full bg-white border border-orange-300 rounded-md px-2 py-1 text-[13px] text-stone-800 focus:outline-none focus:ring-1 focus:ring-orange-400/30"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setGoalDraft(contact.goal ?? ''); setEditingGoal(true); }}
            className="text-left text-[13px] text-stone-600 hover:text-orange-600 truncate w-full"
          >
            {contact.goal || <span className="text-stone-300">Add goal</span>}
          </button>
        )}
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        <span className="text-[14px] text-stone-700 truncate">{companyLabel || '—'}</span>
      </td>

      {/* Last Contacted */}
      <td className="px-4 py-3">
        <span className="text-[14px] text-stone-500">{contact.lastContacted ? formatDate(contact.lastContacted) : '—'}</span>
      </td>

      {/* Next Follow-up */}
      <td className="px-4 py-3">
        <span className="text-[14px] text-stone-500">{contact.nextFollowUpAt ? formatDate(contact.nextFollowUpAt) : '—'}</span>
      </td>

      {/* Email */}
      <td className="px-4 py-3" onClick={stop}>
        {contact.email
          ? <a href={`mailto:${contact.email}`} className="text-[13px] text-stone-500 hover:text-orange-600 truncate">{contact.email}</a>
          : <span className="text-stone-300 text-[13px]">—</span>}
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Lint + verify compile**

Run: `npm run lint` → clean. Confirm the project still type-checks (the component isn't imported anywhere yet — wired up in Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/components/ContactTable.tsx
git commit -m "feat: spreadsheet-style ContactTable with inline edit, sort, search"
```

---

## Task 8: Dashboard Board/Table toggle

Add the view switch and render the table, sharing `useCRMStore` so edits stay in sync.

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add the toggle state and imports**

In `src/app/(app)/dashboard/page.tsx`, add imports near the top:

```tsx
import ContactTable from '@/components/ContactTable';
import { LayoutGrid, Table2, Plus } from 'lucide-react';
```

(Remove the existing standalone `import { Plus } from 'lucide-react';` — it's merged above.)

Add view state alongside the other `useState` hooks:

```tsx
  const [view, setView] = useState<'board' | 'table'>('board');
```

- [ ] **Step 2: Render a header toggle + swap the main region**

Wrap the board's outer container so a small toggle bar sits above it, and render the table when `view === 'table'`. Replace the board container `<div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-3xl ...">…</div>` region with:

```tsx
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* View toggle */}
        <div className="flex-shrink-0 flex items-center gap-1 mb-3 p-1 self-start rounded-full bg-white border border-stone-200/70 shadow-sm">
          <ToggleBtn active={view === 'board'} onClick={() => setView('board')} icon={<LayoutGrid size={14} />} label="Board" />
          <ToggleBtn active={view === 'table'} onClick={() => setView('table')} icon={<Table2 size={14} />} label="Table" />
        </div>

        {view === 'board' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40">
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden overscroll-contain">
              <div className="flex h-full min-w-full divide-x divide-stone-200/70">
                {BOARD_COLUMNS.map(group => (
                  <div key={group.key} className="flex-1 min-w-[208px] flex flex-col min-h-0 px-3 divide-y divide-stone-200/60">
                    {group.statuses.map(status => (
                      <KanbanColumn
                        key={status}
                        status={status}
                        contacts={byStatus[status]}
                        selectedId={selectedContactId}
                        onSelect={(id) => selectContact(selectedContactId === id ? null : id)}
                        onEdit={(id) => setEditingId(id)}
                        onMoveContact={(contactId, s, beforeId) => moveContact(contactId, s, beforeId)}
                        onDelete={deleteContact}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ContactTable
            contacts={contacts}
            selectedId={selectedContactId}
            onSelect={(id) => selectContact(selectedContactId === id ? null : id)}
            onChangeStatus={(id, status) => moveContact(id, status, null)}
            onChangeWarmth={(id, warmth) => updateContact(id, { warmth })}
            onChangeGoal={(id, goal) => updateContact(id, { goal })}
          />
        )}
      </div>
```

Add the `ToggleBtn` helper at the bottom of the file:

```tsx
function ToggleBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
        active ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30' : 'text-stone-500 hover:text-orange-600 hover:bg-orange-50/70'
      }`}
    >
      {icon}{label}
    </button>
  );
}
```

(`contacts` and `updateContact` are already destructured from `useCRMStore` at the top of the component. The detail panel, add button, and all modals remain mounted below regardless of `view`, so they work in both views. The `onUpdateGoal` prop added to `<ContactDetailPanel>` in Task 5 stays.)

- [ ] **Step 3: Lint + run the full suite**

Run: `npm run lint` → clean.
Run: `npm run test` → PASS (all suites).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: Board/Table toggle on the dashboard"
```

---

## Task 9: Database migration (manual) + full verification

- [ ] **Step 1: Run the `goals` table SQL in Supabase**

In the Supabase SQL editor for this project (same project as `contacts`/`chat_sessions`), run:

```sql
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  title       text not null,
  description text,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index goals_user_id_idx on public.goals (user_id);
alter table public.goals enable row level security;
-- No permissive policy: only the service-role key (our server actions) may read/write.
```

- [ ] **Step 2: Manual acceptance pass**

Run the app (`npm run dev`) signed in as a real user and confirm:
1. `/goals`: create a goal → it appears; edit it → change persists; archive → drops from the active list; delete → removed. Reload → state persists.
2. Open a contact (add or edit modal): the goal field suggests your goal titles; pick or type one → saved.
3. Detail panel: the Goals section shows the goal and edits inline (with suggestions).
4. `/dashboard`: toggle Board ↔ Table.
5. Table: change a status inline → toggle to Board → the contact has moved to that column.
6. Table: set temperature stars and edit a goal inline → open the detail panel → both reflect the change.
7. Click a table row → the detail panel opens for that contact.
8. Sort by Status / Temperature / Last Contacted / Next Follow-up (toggle asc/desc); search by name / company / goal / notes filters rows.
9. Visit `/` (Insights) and `/chat` → both still work.

- [ ] **Step 3: Final green check**

Run: `npm run test` → PASS. Run: `npm run lint` → clean.

---

## Self-review notes (for the implementer)

- The `goal` field is optional (`goal?: string`); always read it as `contact.goal ?? ''` in string contexts (done in `tableView`, `draftMessage`, the table, and the panel).
- Status changes from the table go through `moveContact(id, status, null)` (not `updateContact`) so the contact is repositioned into the target board column — keeping Board and Table consistent.
- `score` and `warmth` remain in the model; only `priority`/`inquiry` and the `relationshipGoal` name are gone. `ContactModal` still derives `score` from `warmth`.
- If `npm run build` complains about an unused import after removing the old `Plus` import line in Task 8, ensure the merged `lucide-react` import keeps `Plus`, `LayoutGrid`, and `Table2`.
