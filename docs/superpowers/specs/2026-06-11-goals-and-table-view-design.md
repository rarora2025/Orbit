# Goals + Table View (with model cleanup) — Design

**Date:** 2026-06-11
**Status:** Draft (awaiting user review)

## Problem

Orbit is a personal career/network CRM. The app today has a Dashboard kanban
board, contact cards, a contact detail side panel, lifecycle workflows, and a
timeline. Two capabilities are missing:

1. A lightweight **goals** system — the user wants to name the things they're
   pursuing (e.g. "DraftIQ advice", "Recruiting", "Meet prediction market
   founders") and loosely associate contacts with them.
2. A **table view** of contacts — a clean, spreadsheet-like alternative to the
   board, with inline editing, sorting, and search.

While building these, we also clean up the `Contact` model: two overlapping
"why I care" fields (`inquiry`, `relationshipGoal`) collapse into one, and the
`priority` field is removed in favor of the existing **temperature** rating.

## Decisions (locked during brainstorming)

- **One "goal" field.** Delete `inquiry` (vestigial — always `''`, no form
  field, excluded from search, never rendered). Rename `relationshipGoal` →
  `goal`. This single field is what the detail panel, the contact modal, and the
  table all read/write, and what a selected Goal's title is copied into.
- **Drop `priority`.** Remove the `priority` field and `Priority` type entirely.
  The existing **temperature** signal (model field `warmth`, rendered as 3
  stars) becomes the sole importance indicator, including in the table.
- **Keep the field named `warmth` internally.** The UI already labels it
  "Temperature" everywhere; renaming the code field would mean a wider rename and
  another read-time migration for no user-visible benefit. Internal naming only.
- **Goals storage = relational table** (per the user's spec), not a JSONB blob.
  Goals are flat and small; a real columnar table is clean and matches the
  requested schema. Set up via the Supabase SQL editor like `contacts`.
- **Loose contact↔goal link.** No `contact_goals` join table. Selecting a Goal
  writes its `title` string into `contact.goal`.
- **Goals UI = dedicated `/goals` page** with a 4th sidebar nav entry, not a
  modal.
- **Board ↔ Table share one source of truth** (`useCRMStore`). An edit in either
  view, or in the detail panel, is reflected in the other immediately.
- **Status change from the table uses `moveContact`** (not a raw `updateContact`)
  so the contact lands at a sensible position in the target board column.

## Non-goals (explicitly out of scope)

- CSV import.
- Onboarding flow.
- Graph view.
- AI interpretation.
- A `contact_goals` join table (contacts keep a simple `goal` text field).

## Model cleanup (`Contact`)

In `src/lib/mockData.ts`:

- Remove `inquiry: string`.
- Rename `relationshipGoal?: string` → `goal?: string`.
- Remove `priority: Priority` and the `Priority` type.

Cascading edits:

- `src/lib/utils.ts` — remove `getPriorityColor`, `getPriorityIcon`, and the
  `Priority` import.
- `src/components/PriorityBadge.tsx` — **delete** (only consumer was the dead
  `ContactTable`).
- `src/components/ContactModal.tsx` — drop the `inquiry: ''` and
  `priority: 'Medium'` initializers; rename the `relationshipGoal` form key and
  field to `goal`. (The modal already has a "Temperature" segmented control and a
  "Goals" `<datalist>` field — those stay.)
- `src/components/ContactDetailPanel.tsx` — the "Goals" section reads `c.goal`
  and becomes inline-editable (see Table/Detail editing below).
- `src/lib/draftMessage.ts`, `src/lib/ai.actions.ts` — read `contact.goal`.
- Tests (`store.test.ts`, `contactDerive.test.ts`, `contactSearch.test.ts`,
  `nextMoves.test.ts`, `draftMessage.test.ts`) — drop `inquiry`/`priority` from
  fixtures, rename `relationshipGoal` → `goal`.

**Read-time back-compat.** Existing Supabase contact rows store the blob with the
old `relationshipGoal` key. In `rowToContact` (`contacts.actions.ts`), map:

```ts
const { relationshipGoal, inquiry, priority, ...rest } = r.data as any;
return { ...rest, goal: rest.goal ?? relationshipGoal, id: r.id, position: r.position };
```

so old data keeps its goal text and the dropped fields are quietly discarded on
the next write. The `score` field is left untouched (still derived from warmth in
the modal); it simply isn't shown as a table column.

## Goals system

### `goals` table (Supabase SQL — user runs in the SQL editor)

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

### `src/lib/goals.actions.ts` (`'use server'`)

Mirror the `contacts.actions.ts` conventions: `requireUserId()` scoping, the
`supabaseAdmin` service-role client, every query filtered by `user_id`.

```ts
export interface Goal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

listGoals(): Promise<Goal[]>            // where user_id = userId, order by created_at
addGoal(input: { title: string; description?: string }): Promise<Goal>
updateGoal(id, updates: Partial<Pick<Goal,'title'|'description'|'status'>>): Promise<Goal>
deleteGoal(id): Promise<void>           // hard delete; "archive" is updateGoal({status:'archived'})
```

A row maps directly to `Goal` (columnar, no JSONB blob). Foreign ids match
nothing because every query is scoped by `user_id`.

### `src/lib/goalsStore.ts` (Zustand)

Mirror `store.ts`: in-memory `goals: Goal[]`, `loaded`, optimistic apply +
server write for add/update/delete, a `setGoals` hydrator.

### Hydration

`StoreHydrator.tsx` also calls `listGoals().then(setGoals)` on mount (same
pattern as contacts/chats).

### `/goals` page + nav

- `src/app/(app)/goals/page.tsx` — `'use client'`. Header with title + "New
  goal" button. Grid/list of **active** goals as rounded white cards (orange
  accent, subtle border). Each card: title, description, edit + archive/delete
  controls. A small inline form (or modal) for create/edit. Empty state in the
  Orbit style. Loading guard until `loaded`, like the dashboard.
- `src/components/Sidebar.tsx` — add a 4th nav item `{ href: '/goals', icon:
  Target, label: 'Goals' }` (lucide `Target`).

### Contact ↔ goal link

- `ContactModal` "Goals" `<datalist>` is fed the user's actual goal titles (from
  `goalsStore`), so the user can pick an existing goal or type a free one. The
  selected/typed string is saved into `contact.goal`.
- `ContactDetailPanel` "Goals" section shows `c.goal` and is inline-editable; a
  small picker offers existing goal titles. Saving calls `updateContact(id,
  { goal })`.

## Table view (Dashboard)

### View toggle

`src/app/(app)/dashboard/page.tsx` gains a compact header row with a Board/Table
segmented control (orange-accented, like the modal temperature control). Local
`useState<'board' | 'table'>` (default `'board'`). Both views read the same
`useCRMStore`; switching is purely a render swap. The detail panel, add button,
and all modals stay mounted regardless of view.

### `src/components/ContactTable.tsx` (rewritten)

The current file is dead code (no live importer) and is replaced. Columns:

**Person · Status · Temperature · Goal · Company · Last Contacted · Next Follow-up · Email**

Design: clean modern spreadsheet — white background, subtle stone borders,
rounded container, comfortable row height, status pills matching the board
colors (`columnConfig` from `mockData`). Not a heavy enterprise grid.

### Inline editing

- **Status** — dropdown (`<select>` or small popover) of the 7 statuses
  (`BOARD_STATUSES`). On change: `moveContact(id, newStatus, null)` (appends to
  the target column so board ordering stays sane).
- **Temperature** — clickable 3-star control (reuse the star rendering from
  `ContactCard`/detail panel, `Low/Medium/High → 1/2/3`). On change:
  `updateContact(id, { warmth })`.
- **Goal** — inline editable text (click to edit, blur/Enter to commit). On
  commit: `updateContact(id, { goal })`.
- **Last Contacted / Next Follow-up** — read-only formatted dates
  (`formatDate`); em-dash ("—") when unset.
- **Email** — `mailto:` link, or em-dash when empty.
- **Row click** (outside an editable control) → `selectContact(id)`, opening the
  existing `ContactDetailPanel`. Editable controls call `stopPropagation` so a
  click to edit doesn't also open the panel.

### Sort + search (client-side, pure helpers)

A new `src/lib/tableView.ts` exports pure functions so they're unit-testable:

- `sortContacts(contacts, key, dir)` where `key ∈ {status, temperature,
  lastContacted, nextFollowUpAt}`. Status sorts by `BOARD_STATUSES` index;
  temperature by `Low<Medium<High`; dates chronologically (unset sorts last).
- `searchContacts(contacts, query)` — case-insensitive match over name, company,
  goal, notes.

The table component holds `sortKey`/`sortDir`/`query` UI state, applies
`searchContacts` then `sortContacts` via `useMemo`. Clicking a column header
toggles sort on sortable columns; a search input sits in the table header bar.

## Data flow / source of truth

- Contacts: unchanged — `useCRMStore` hydrated by `StoreHydrator`, mutations are
  optimistic + server-backed via `contacts.actions`. Board and Table both render
  from this store, so a status edit in the table (`moveContact`) re-renders the
  board, and a detail-panel edit re-renders the table.
- Goals: new `goalsStore` hydrated alongside, same optimistic + server pattern.

## Files

**Create:**
- `docs/superpowers/specs/2026-06-11-goals-and-table-view-design.md` (this doc)
- `src/lib/goals.actions.ts` (+ `goals.actions.test.ts`)
- `src/lib/goalsStore.ts`
- `src/lib/tableView.ts` (+ `tableView.test.ts`)
- `src/app/(app)/goals/page.tsx`

**Modify:**
- `src/lib/mockData.ts` — drop `inquiry`, `Priority`/`priority`; rename
  `relationshipGoal` → `goal`.
- `src/lib/contacts.actions.ts` — `rowToContact` back-compat for `goal`.
- `src/lib/utils.ts` — remove priority helpers.
- `src/lib/draftMessage.ts`, `src/lib/ai.actions.ts` — read `contact.goal`.
- `src/components/ContactModal.tsx` — `goal` key; feed goal titles into datalist.
- `src/components/ContactDetailPanel.tsx` — inline-editable `goal`.
- `src/components/ContactTable.tsx` — full rewrite (new columns + inline edit +
  sort/search).
- `src/components/Sidebar.tsx` — add Goals nav item.
- `src/components/StoreHydrator.tsx` — hydrate goals.
- `src/app/(app)/dashboard/page.tsx` — Board/Table toggle.
- Tests referencing the dropped/renamed fields.

**Delete:**
- `src/components/PriorityBadge.tsx`.

## Testing

- **Unit — goals.actions:** CRUD with Supabase client + Clerk `auth()` mocked;
  every read/write scoped by `userId`; missing user rejected; a foreign id
  mutates nothing. Mirrors the existing `contacts.actions` test style.
- **Unit — goalsStore:** hydrate + optimistic add/update/delete reducers.
- **Unit — tableView:** `sortContacts` (each key, both directions, unset dates
  last) and `searchContacts` (matches name/company/goal/notes, case-insensitive).
- **Unit — rowToContact:** old `relationshipGoal` row yields `goal`; dropped
  fields discarded.
- **Existing tests** updated for the renamed/removed fields and still pass.
- `npm run test` and `npm run lint` are green.

- **Manual acceptance:**
  1. Run the `goals` table SQL in Supabase.
  2. `/goals`: create a goal, edit it, archive/delete it; active goals list.
  3. Open a contact's detail panel / add modal: assign a goal (pick existing or
     type free); it saves to `contact.goal`.
  4. On `/dashboard`, toggle Board ↔ Table.
  5. In Table, change a status inline → switch to Board → the contact moved.
  6. In Table, edit temperature and goal inline → reflected in the detail panel.
  7. Click a table row → the detail panel opens for that contact.
  8. Sort by each sortable column; search by name/company/goal/notes filters.
  9. Confirm Chat and Insights still work.

## Acceptance criteria

- `Contact` has a single `goal` field; `inquiry`, `relationshipGoal`, and
  `priority` are gone; existing contacts keep their goal text via read-time
  back-compat.
- Temperature (3 stars) is the only importance signal; no priority UI remains.
- A `/goals` page (with sidebar nav) supports create / edit / archive(delete) /
  list of active goals, per-user via Supabase.
- The Dashboard offers a Board/Table toggle over the same data; the table has the
  specified columns, inline editing of status/temperature/goal, formatted dates,
  sorting, search, and opens the detail panel on row click.
- Editing in any view is reflected in the others (single source of truth).
- Chat and Insights are unaffected.
- `npm run test` and `npm run lint` pass.
