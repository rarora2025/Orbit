# Orbit Lifecycle Redesign — Phase 1: Interactions Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move interactions out of the contact JSONB blob into a real `interactions` table (with a structured `due_at`), without changing any visible behavior.

**Architecture:** A new `interactions` Supabase table is the source of truth for all timeline events. A new `src/lib/interactions.actions.ts` module owns row-level I/O (`insertInteraction`, `listUserInteractions`). `listContacts()` joins interactions onto each contact in memory, so existing components keep reading `contact.interactions`. The interaction-writing actions in `contacts.actions.ts` delegate the row write to `insertInteraction` and stop appending to the blob (they persist the contact's `data` with an empty `interactions` array). Existing blob data is migrated once via SQL.

**Tech Stack:** Next.js 16 (App Router, server actions), Supabase (`supabaseAdmin`, service-role), Clerk auth, Zustand store, Vitest.

---

## Context for the implementer

- **This is a refactor of in-progress work.** The working tree currently has an uncommitted blob-based lifecycle implementation (`ScheduleMeetingModal`, `MarkMetModal`, `AddNoteModal`, `SetFollowUpModal`, plus `scheduleMeeting`/`markMet`/`addNote`/`setFollowUp`/`changeStatusLogged` in `contacts.actions.ts`, store methods, and `meeting.ts`). Task 0 commits it as a baseline. **Do not delete those files in this phase** — UI changes are Phase 2.
- **Spec:** `docs/superpowers/specs/2026-06-11-orbit-lifecycle-redesign-design.md`. This plan implements **Phase 1 only**.
- **Existing test/mock pattern:** see `src/lib/contacts.actions.test.ts` — Supabase is mocked by stubbing the `supabaseAdmin.from(...)` chain. New tests in this plan use the same approach with their own harness.
- **Statuses are capitalized** (`'Meeting Scheduled'` etc.); interaction `type` values are snake_case (`'meeting_scheduled'` etc.). Do not change these.
- **Run commands from the repo root** `/Users/Rahul19/conductor/workspaces/orbit/davao`. Tests: `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`.

---

## Task 0: Commit the current lifecycle work as a baseline

**Files:** none created — commits existing working-tree changes.

- [ ] **Step 1: Confirm the working tree matches the expected baseline**

Run: `git status --short`
Expected (order may vary):
```
 M src/app/(app)/dashboard/page.tsx
 M src/components/ContactDetailPanel.tsx
 M src/lib/contacts.actions.ts
 M src/lib/mockData.ts
 M src/lib/store.test.ts
 M src/lib/store.ts
?? src/components/AddNoteModal.tsx
?? src/components/MarkMetModal.tsx
?? src/components/ScheduleMeetingModal.tsx
?? src/components/SetFollowUpModal.tsx
?? src/lib/meeting.test.ts
?? src/lib/meeting.ts
```

- [ ] **Step 2: Verify the baseline is green**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: blob-based lifecycle workflows (baseline before interactions-table refactor)"
```

---

## Task 1: Add `dueAt` to the `Interaction` type

**Files:**
- Modify: `src/lib/mockData.ts` (the `Interaction` interface)

- [ ] **Step 1: Add the field**

In `src/lib/mockData.ts`, the `Interaction` interface currently ends with `content` and `nextStep`. Add `dueAt`:

```ts
export interface Interaction {
  id: string;
  date: string;
  type:
    | 'sent' | 'received' | 'note' | 'meeting'
    | 'message_drafted' | 'message_sent' | 'follow_up_scheduled' | 'response_logged'
    | 'meeting_scheduled' | 'meeting_completed' | 'note_added' | 'status_changed';
  channel?: string;
  content: string;
  /** Optional captured next step (e.g. "Schedule meeting"), shown as a chip. */
  nextStep?: string;
  /** ISO timestamp for a scheduled date (meeting time, or follow-up due date). */
  dueAt?: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mockData.ts
git commit -m "feat: add dueAt to Interaction type"
```

---

## Task 2: Create the `interactions` table + backfill (manual SQL)

**Files:**
- Create: `docs/superpowers/sql/2026-06-11-interactions-table.sql` (checked-in record of the DDL the operator runs)

This project has no migration tooling; the `contacts` table was created by hand in the Supabase SQL editor. Do the same here. The SQL file is committed so the schema change is documented in the repo.

- [ ] **Step 1: Write the SQL file**

Create `docs/superpowers/sql/2026-06-11-interactions-table.sql`:

```sql
-- Phase 1: interactions table + one-time backfill from contacts.data.interactions[]
-- Run once in the Supabase SQL editor for the project.

create table if not exists public.interactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text        not null,
  contact_id  uuid        not null,
  type        text        not null,
  content     text        not null default '',
  due_at      timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists interactions_user_contact_idx on public.interactions (user_id, contact_id);
create index if not exists interactions_user_due_idx     on public.interactions (user_id, due_at);

-- One-time backfill: expand each contact's embedded interactions into rows.
-- due_at is left null for historical rows (no reliable structured date in the old blob).
insert into public.interactions (id, user_id, contact_id, type, content, due_at, created_at)
select
  coalesce(nullif(i->>'id','')::uuid, gen_random_uuid()),
  c.user_id,
  c.id,
  i->>'type',
  coalesce(i->>'content', ''),
  null,
  coalesce((i->>'date')::timestamptz, now())
from public.contacts c
cross join lateral jsonb_array_elements(coalesce(c.data->'interactions', '[]'::jsonb)) as i
on conflict (id) do nothing;
```

- [ ] **Step 2: Run it against Supabase**

Open the Supabase project's SQL editor and run the file's contents. (The `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` identifies the project.)

- [ ] **Step 3: Verify the table exists and was backfilled**

In the SQL editor run:
```sql
select count(*) from public.interactions;
select type, count(*) from public.interactions group by type order by 2 desc;
```
Expected: a row count roughly equal to the number of embedded interactions across all contacts; types match the snake_case set.

- [ ] **Step 4: Commit the SQL record**

```bash
git add docs/superpowers/sql/2026-06-11-interactions-table.sql
git commit -m "chore: SQL for interactions table + backfill (run manually in Supabase)"
```

---

## Task 3: `interactions.actions.ts` — row I/O

**Files:**
- Create: `src/lib/interactions.actions.ts`
- Test: `src/lib/interactions.actions.test.ts`

The module exposes two server actions plus a row type. `insertInteraction` writes one row; `listUserInteractions` reads all of a user's interactions as `Interaction[]` keyed for joining.

- [ ] **Step 1: Write the failing test**

Create `src/lib/interactions.actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'user_123' });
  insert.mockResolvedValue({ error: null });
  order.mockResolvedValue({ data: [], error: null });
  eq.mockReturnValue({ eq, order });
  select.mockReturnValue({ eq, order });
  from.mockReturnValue({ insert, select });
});

describe('insertInteraction', () => {
  it('inserts a row into the interactions table scoped to the user', async () => {
    const { insertInteraction } = await import('./interactions.actions');
    await insertInteraction('contact_1', { type: 'note_added', content: 'hi', dueAt: '2026-06-18T12:00:00.000Z' });
    expect(from).toHaveBeenCalledWith('interactions');
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      user_id: 'user_123',
      contact_id: 'contact_1',
      type: 'note_added',
      content: 'hi',
      due_at: '2026-06-18T12:00:00.000Z',
    });
    expect(typeof row.id).toBe('string');
    expect(typeof row.created_at).toBe('string');
  });

  it('throws when not authenticated', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { insertInteraction } = await import('./interactions.actions');
    await expect(insertInteraction('c', { type: 'note_added', content: 'x' })).rejects.toThrow(/auth/i);
  });
});

describe('listUserInteractions', () => {
  it('selects the user rows and maps them to Interaction objects grouped by contact', async () => {
    order.mockResolvedValue({
      data: [
        { id: 'i1', contact_id: 'c1', type: 'note_added', content: 'a', due_at: null, created_at: '2026-06-10T00:00:00.000Z' },
        { id: 'i2', contact_id: 'c1', type: 'meeting_scheduled', content: 'm', due_at: '2026-06-18T14:00:00.000Z', created_at: '2026-06-11T00:00:00.000Z' },
      ],
      error: null,
    });
    const { listUserInteractions } = await import('./interactions.actions');
    const byContact = await listUserInteractions('user_123');
    expect(from).toHaveBeenCalledWith('interactions');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    const c1 = byContact.get('c1')!;
    expect(c1).toHaveLength(2);
    expect(c1[0]).toMatchObject({ id: 'i1', type: 'note_added', content: 'a', date: '2026-06-10T00:00:00.000Z' });
    expect(c1[1]).toMatchObject({ id: 'i2', type: 'meeting_scheduled', dueAt: '2026-06-18T14:00:00.000Z' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/interactions.actions.test.ts`
Expected: FAIL — cannot find module `./interactions.actions`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/interactions.actions.ts`:

```ts
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
  type: string;
  content: string;
  due_at: string | null;
  created_at: string;
}

function rowToInteraction(r: InteractionRow): Interaction {
  return {
    id: r.id,
    date: r.created_at,
    type: r.type as Interaction['type'],
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

/** Load all of a user's interactions, grouped by contact id, sorted oldest→newest. */
export async function listUserInteractions(userId: string): Promise<Map<string, Interaction[]>> {
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/interactions.actions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/interactions.actions.ts src/lib/interactions.actions.test.ts
git commit -m "feat: interactions.actions row I/O (insertInteraction, listUserInteractions)"
```

---

## Task 4: `listContacts` attaches interactions from the table

**Files:**
- Modify: `src/lib/contacts.actions.ts` (`listContacts`)
- Test: `src/lib/contacts.actions.test.ts` (add a case)

`listContacts` must override each contact's `interactions` with the table rows (newest first), so the blob copy is never used for display.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/contacts.actions.test.ts` inside the existing file. First, extend the top-of-file mock so the `interactions` select resolves with rows. Replace the existing `beforeEach` body's `order.mockResolvedValue(...)` line so the contacts query and interactions query can return different data. Add this new `describe` block at the end of the file:

```ts
describe('listContacts interactions join', () => {
  it('attaches interactions from the table, newest first, overriding the blob', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });

    // contacts query resolves first (order on contacts), interactions query second.
    order
      .mockResolvedValueOnce({
        data: [{ id: 'c1', position: 1000, data: { id: 'c1', status: 'Send', interactions: [{ id: 'stale', date: '2000-01-01', type: 'note', content: 'blob' }] } }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'i1', contact_id: 'c1', type: 'note_added', content: 'older', due_at: null, created_at: '2026-06-10T00:00:00.000Z' },
          { id: 'i2', contact_id: 'c1', type: 'message_sent', content: 'newer', due_at: null, created_at: '2026-06-11T00:00:00.000Z' },
        ],
        error: null,
      });

    const { listContacts } = await import('./contacts.actions');
    const contacts = await listContacts();
    const c1 = contacts.find((c) => c.id === 'c1')!;
    expect(c1.interactions.map((i) => i.id)).toEqual(['i2', 'i1']); // newest first
    expect(c1.interactions.some((i) => i.id === 'stale')).toBe(false); // blob copy ignored
  });
});
```

Also confirm the file's mock `order` is a plain `vi.fn()` (it is) so `mockResolvedValueOnce` chaining works.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/contacts.actions.test.ts`
Expected: FAIL — current `listContacts` returns the blob `interactions` (`['stale']`), so the assertion `['i2','i1']` fails.

- [ ] **Step 3: Modify `listContacts`**

In `src/lib/contacts.actions.ts`, add the import at the top (below the existing imports):

```ts
import { listUserInteractions } from './interactions.actions';
```

Replace the body of `listContacts` with:

```ts
export async function listContacts(): Promise<Contact[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('id, position, data')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  const byContact = await listUserInteractions(userId);
  return (data as Row[]).map((r) => {
    const contact = rowToContact(r);
    // The interactions table is the source of truth; show newest first.
    contact.interactions = [...(byContact.get(r.id) ?? [])].reverse();
    return contact;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/contacts.actions.test.ts`
Expected: PASS (existing cases + the new join case).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts.actions.ts src/lib/contacts.actions.test.ts
git commit -m "feat: listContacts attaches interactions from the table"
```

---

## Task 5: Route interaction writes to the table (stop writing the blob array)

**Files:**
- Modify: `src/lib/contacts.actions.ts` (all interaction-writing actions + helpers)

Every action that previously pushed onto `current.interactions` and wrote it back into the blob now: (a) inserts a row via `insertInteraction`, (b) persists the contact's `data` with `interactions: []`, and (c) returns the in-memory contact with the new interaction appended so the store updates the timeline immediately.

The affected actions: `addDraftInteraction`, `markMessageSent`, `logResponse`, `scheduleMeeting`, `markMet`, `addNote`, `setFollowUp`, `changeStatusLogged`. (`setFollowUp` stays for now; its UI is removed in Phase 2.)

- [ ] **Step 1: Add a contact-fields persist helper that strips interactions**

In `src/lib/contacts.actions.ts`, the existing private `persist(userId, contactId, merged)` writes `data: merged`. Replace it so it never writes the interactions array into the blob:

```ts
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
```

- [ ] **Step 2: Add the import for `insertInteraction`**

At the top of `src/lib/contacts.actions.ts` add (if not already present from Task 4, add `insertInteraction` to the same import line):

```ts
import { listUserInteractions, insertInteraction } from './interactions.actions';
```

- [ ] **Step 3: Rewrite `addDraftInteraction` (uses the older `requireUserId`/inline pattern)**

Replace the whole `addDraftInteraction` function with:

```ts
/** Append a "message_drafted" interaction. Does NOT change status. */
export async function addDraftInteraction(contactId: string, input: InteractionInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const interaction = await insertInteraction(contactId, { type: 'message_drafted', content: input.content });
  return persist(userId, contactId, { ...current, interactions: [...current.interactions, interaction] });
}
```

- [ ] **Step 4: Rewrite `markMessageSent`**

Replace the whole `markMessageSent` function with:

```ts
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
```

- [ ] **Step 5: Rewrite `logResponse`**

Replace the whole `logResponse` function with:

```ts
export async function logResponse(contactId: string, input: ResponseInput): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const interaction = await insertInteraction(contactId, {
    type: 'response_logged', content: input.content.trim(),
  });
  // Preserve the captured next step on the in-memory object (chip in the timeline).
  interaction.nextStep = input.nextStep;
  return persist(userId, contactId, {
    ...current,
    status: 'Response',
    nextFollowUpAt: undefined,
    interactions: [...current.interactions, interaction],
  });
}
```

Note: `nextStep` is presentation-only and not persisted to the table in Phase 1 (the column doesn't exist). It survives on the returned object for the immediate render; Phase 2/3 decide its long-term home. This is intentional and acceptable for Phase 1.

- [ ] **Step 6: Rewrite `scheduleMeeting`, `markMet`, `addNote`, `setFollowUp`, `changeStatusLogged`**

Replace each of these functions (the block appended at the end of the file) as follows.

```ts
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

export async function changeStatusLogged(contactId: string, toStatus: Status, content: string): Promise<Contact> {
  const { userId, current } = await requireContact(contactId);
  const interaction = await insertInteraction(contactId, { type: 'status_changed', content });
  return persist(userId, contactId, {
    ...current,
    status: toStatus,
    interactions: [...current.interactions, interaction],
  });
}
```

- [ ] **Step 7: Remove the now-unused blob-interaction helpers**

In `src/lib/contacts.actions.ts`, delete `buildInteraction` (the `InteractionInput`-based factory) and `newInteraction` (the channel-less factory) — both are now unused because all interaction objects come back from `insertInteraction`. Keep the `InteractionInput` interface (still used as the input type for `addDraftInteraction`/`markMessageSent`). Keep `requireContact` and the `MeetingInput`/`MetInput`/`FollowUpInput`/`ResponseInput` interfaces.

- [ ] **Step 8: Verify typecheck and existing tests**

Run: `npx tsc --noEmit`
Expected: no errors. If `buildInteraction`/`newInteraction` removal left an unused import (e.g. `Interaction`), keep `Interaction` only if still referenced (it is, via interfaces) — otherwise remove it from the import.

Run: `npx vitest run`
Expected: all pass. The store tests mock `contacts.actions`, so they are unaffected by the internal rewrite.

- [ ] **Step 9: Commit**

```bash
git add src/lib/contacts.actions.ts
git commit -m "refactor: interaction-writing actions write to the interactions table, not the blob"
```

---

## Task 6: Full verification

**Files:** none.

- [ ] **Step 1: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: no type errors; all tests pass; build completes with routes `/`, `/chat`, `/dashboard`.

- [ ] **Step 2: Manual smoke (requires the table created in Task 2)**

Run: `npm run dev`, open `/dashboard`. Open a contact → Draft message → Save draft → confirm "Draft message" appears in the timeline. Mark sent → confirm it moves to Pending and "Message sent" + "Follow-up scheduled" appear. Reload the page — the timeline still shows those events (proving they came from the table, not in-memory state).

- [ ] **Step 3: Confirm no regressions in counts/panel**

Schedule a meeting on a Response contact → it moves to Meeting Scheduled, panel stays open, timeline updates. Reload → still correct.

There is no commit in this task; it is verification only.

---

## Self-review notes (for the implementer)

- **Source of truth:** after this phase, the contact `data` blob's `interactions` array is always written as `[]`; the table is authoritative. `listContacts` reverses the oldest→newest table order into newest-first for display, matching the panel's existing sort expectation.
- **`nextStep`** is not yet a table column; it rides on the returned object only. Don't add a column in Phase 1.
- **Out of scope for Phase 1:** no UI/button changes, no timeline restyle, no card badges, no Insights agenda, no removal of `SetFollowUpModal`/`setFollowUp`. Those are Phases 2–4, each with its own plan.
```
