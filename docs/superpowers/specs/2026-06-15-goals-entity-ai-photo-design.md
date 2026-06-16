# Goals as First-Class Entities (with AI photo + people) — Design

**Date:** 2026-06-15
**Status:** Approved (brainstorming complete)

## Problem

Today a contact's "goal" is an open-ended free-text field (a `<datalist>` in the
Add/Edit Person modal — you can type anything). The user wants **goals to be
first-class entities** they can name and manage: a goal has a title, an
AI-generated photo, and a set of associated people. People should only be
addable to goals that **already exist** (no more open-ended typing). Goals are
created from the **Insights** page now (the app's landing page), and will also be
created during onboarding later (out of scope here, but the same actions are
reused).

This supersedes the unbuilt "Goals system" portion of
`2026-06-11-goals-and-table-view-design.md` (only that doc's table view + model
cleanup shipped; no goals table/page was ever built). This design makes goals
real entities and retires the free-text `goal` input.

## Decisions (locked during brainstorming)

- **Many-to-many.** A person can belong to multiple goals; a goal has multiple
  people. **The goal owns its membership** (`member_ids`) — single source of
  truth for the link. No join table (kept simple per the goal-owns-members
  approach).
- **AI photo auto-generates on create.** Creating a goal inserts the row
  immediately, then generates the image in the background and patches it in. A
  regenerate control re-rolls. Generation never blocks creation; on failure the
  card falls back to a colored gradient + the goal's initial.
- **Image generation is server-side only.** Pollinations `sk_` key lives in
  `.env.local` as `POLLINATIONS_API_KEY` (gitignored, same as `OPEN_AI_KEY`) and
  is never sent to the browser. The stored `image_url` is a key-free
  content-addressed URL (re-hosted on Pollinations media storage).
- **Retire the open-ended field.** The free-text Goals input is removed from the
  Add/Edit Person modal. `contact.goal` becomes a **server-derived, read-only**
  value (joined titles of the goals a contact belongs to) so AI draft context
  keeps working unchanged.
- **Goals UI lives on the Insights page** (`app/(app)/page.tsx`), not a dedicated
  route, plus a goal detail modal and a membership picker in the person detail
  panel. (Image generation is for goals only — not contacts.)
- **Storage = relational `goals` table**, set up via the Supabase SQL editor,
  mirroring the `contacts` conventions (service-role client, every query scoped
  by Clerk `user_id`).

## Non-goals (out of scope)

- Onboarding flow (will reuse `addGoal` / `generateGoalImage` later).
- AI-generated photos for contacts/people — goals only.
- A `Goal` column in the dashboard table (it has none today; unchanged).
- Editing goal membership during initial person creation (assign goals after the
  person exists, from the goal card or the person's detail panel).
- Goal "status"/archive lifecycle — delete is the only removal for now.

## Data model

### `goals` table (Supabase SQL — user runs in the SQL editor)

```sql
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  title       text not null,
  image_url   text,                        -- AI-generated, key-free media URL (nullable)
  member_ids  jsonb not null default '[]', -- contact ids associated with this goal
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index goals_user_id_idx on public.goals (user_id);
alter table public.goals enable row level security;
-- No permissive policy: only the service-role key (our server actions) read/write.
```

A row maps directly to a `Goal` (columnar; `member_ids` is a small JSONB array of
contact ids).

```ts
export interface Goal {
  id: string;
  title: string;
  imageUrl: string | null;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

## AI photo (Pollinations)

`src/lib/goals.actions.ts` exposes `generateGoalImage(goalId, title)`:

1. **Generate.** GET
   `https://gen.pollinations.ai/image/<urlencoded prompt>?model=flux&width=768&height=512&nologo=true`
   with header `Authorization: Bearer <POLLINATIONS_API_KEY>`. Read the response
   as bytes. Prompt is a tasteful default built from the title:
   `"<title>, minimal modern editorial illustration, soft warm palette, abstract, no text"`.
2. **Re-host.** POST those bytes to `https://media.pollinations.ai/upload`
   (multipart `file`, same Bearer auth) → returns a stable content-addressed URL.
   This avoids storing any URL containing the `sk_` key.
3. **Persist.** `updateGoal(goalId, { imageUrl })` with the re-hosted URL.
4. On any failure (missing key, non-2xx, network): log and return `null`; the goal
   keeps `imageUrl = null` and the card renders its gradient fallback.

The `width`/`height`/style are server-side defaults — the user writes no prompt.

## Server actions + store

### `src/lib/goals.actions.ts` (`'use server'`)

Mirrors `contacts.actions.ts`: `requireUserId()` scoping, `supabaseAdmin`
service-role client, every query filtered by `user_id`. Column ↔ camelCase
mapping in a `rowToGoal` helper.

```ts
listGoals(): Promise<Goal[]>                       // user_id = userId, order by created_at
addGoal(input: { title: string }): Promise<Goal>   // inserts with image_url null, member_ids []
updateGoal(id, updates: Partial<Pick<Goal,'title'|'imageUrl'>>): Promise<Goal>
deleteGoal(id): Promise<void>
addGoalMember(goalId, contactId): Promise<Goal>     // append contactId if absent
removeGoalMember(goalId, contactId): Promise<Goal>  // drop contactId
generateGoalImage(goalId, title): Promise<Goal | null> // see "AI photo" above
```

Member mutations read the goal (scoped by user), edit `member_ids`, and persist —
idempotent (adding an existing member or removing an absent one is a no-op write).

### `src/lib/goalsStore.ts` (Zustand)

Mirrors `store.ts`: in-memory `goals: Goal[]`, `loaded`, a `setGoals` hydrator,
and optimistic apply + server write for `addGoal`, `updateGoal`, `deleteGoal`,
`addMember`, `removeMember`. `addGoal` optimistically inserts the goal, then fires
`generateGoalImage` and patches `imageUrl` when it resolves (drives the card
spinner → image transition).

### Hydration

`StoreHydrator.tsx` also calls `listGoals().then(setGoals)` on mount (same pattern
as contacts/chats).

## Retiring the open-ended `goal` field

- **`ContactModal.tsx`:** remove the Goals `<input>` + `relationship-goals`
  `<datalist>` + `GOAL_SUGGESTIONS`, and drop `goal` from form state / the
  built contact / the `onSave` payload. (New contacts simply omit `goal`.)
- **`contacts.actions.ts` (`listContacts`):** after building contacts, fetch the
  user's goals and set each `contact.goal` to the comma-joined titles of the goals
  whose `member_ids` include that contact's id (`undefined`/empty when none). This
  is the only writer of `contact.goal` going forward. `rowToContact` stops
  trusting any stored `goal` (it's overwritten by the derived value).
- **`draftMessage.ts` / `ai.actions.ts`:** unchanged — they keep reading
  `contact.goal`, now populated by the derivation. `ai.actions.generateDraft`
  already calls `listContacts()` per request, so it always sees fresh membership.

## UI

### Insights page (`app/(app)/page.tsx`) — new "Goals" section

Placed above "Your next moves", matching the existing rounded-card / orange-accent
visual language.

- **Goal rail:** horizontal scroll of goal cards. Each card: AI image banner (or
  gradient + initial fallback; spinner while generating), title, a small stacked
  row of member avatars + overflow count. Loading guard until `goalsStore.loaded`.
- **"+ New goal"** trailing card/button → small modal with a single title input.
  Submit creates instantly (`addGoal`) and kicks off image generation.
- **Goal detail modal** (click a card): AI image with a **Regenerate** button,
  editable title (commits via `updateGoal`), the member list with remove buttons,
  and an **Add people** picker that searches the user's **existing contacts only**
  (from `useCRMStore`) and toggles membership (`addGoalMember` /
  `removeGoalMember`). **Delete goal** lives here.

Member avatars reuse the contact `avatarColor` + initial convention already used on
the board/cards.

### Person detail panel (`ContactDetailPanel.tsx`) — "Goals" section

Replaces the read-only `c.goal` text with a chip list of the goals this person
belongs to, read from `goalsStore` (`goals.filter(g => g.memberIds.includes(c.id))`).
A small picker toggles membership across **existing goals only** (no free typing) —
the person→goal direction. Empty state when the user has no goals yet ("Create a
goal on Insights first").

## Environment

`.env.local` gains `POLLINATIONS_API_KEY=sk_...` (gitignored). `goals.actions`
reads `process.env.POLLINATIONS_API_KEY`; when absent, `generateGoalImage` is a
safe no-op returning `null` (goal still created, no image).

## Files

**Create:**
- `docs/superpowers/specs/2026-06-15-goals-entity-ai-photo-design.md` (this doc)
- `src/lib/goals.actions.ts` (+ `goals.actions.test.ts`)
- `src/lib/goalsStore.ts` (+ `goalsStore.test.ts`)
- `src/components/GoalCard.tsx` — single goal card (image/fallback, title, members)
- `src/components/NewGoalModal.tsx` — title-only create modal
- `src/components/GoalDetailModal.tsx` — image + regenerate, title edit, members,
  add-people picker, delete
- `docs/superpowers/sql/2026-06-15-goals-table.sql` — the `goals` DDL

**Modify:**
- `src/lib/mockData.ts` — keep `goal?: string` but document it as derived/read-only.
- `src/lib/contacts.actions.ts` — derive `contact.goal` from goal membership in
  `listContacts`; `rowToContact` no longer trusts stored `goal`.
- `src/components/ContactModal.tsx` — remove the Goals input/datalist/suggestions
  and the `goal` form field.
- `src/components/ContactDetailPanel.tsx` — Goals section → membership chips +
  existing-goals picker (reads/writes `goalsStore`).
- `src/components/StoreHydrator.tsx` — hydrate goals.
- `src/app/(app)/page.tsx` — add the Goals section + modals.
- `.env.local` — add `POLLINATIONS_API_KEY`.

**No table changes:** the dashboard table has no Goal column today; unchanged.

## Data flow / source of truth

- **Goal membership:** `goals.member_ids` is authoritative. `goalsStore` holds it
  client-side; the goal card, goal detail modal, and person detail panel all read
  and mutate it. Optimistic + server-backed.
- **`contact.goal`:** derived read-only denormalization computed in `listContacts`
  from membership. Client-side membership edits update `goalsStore` immediately;
  `contact.goal` refreshes on the next `listContacts` (and `ai.actions` always
  recomputes server-side per request, so AI context is never stale).

## Testing

- **Unit — `goals.actions`:** CRUD + `addGoalMember`/`removeGoalMember` with
  Supabase client + Clerk `auth()` mocked; every read/write scoped by `userId`;
  missing user rejected; a foreign id mutates nothing; member ops idempotent.
  `generateGoalImage`'s `fetch` (generate + upload) mocked — success persists the
  re-hosted URL; failure returns `null` without throwing; missing key is a no-op.
- **Unit — `goalsStore`:** hydrate + optimistic add/update/delete/member-toggle
  reducers; `addGoal` patches `imageUrl` after generation resolves.
- **Unit — `listContacts` derivation:** a contact in two goals gets both titles
  joined into `contact.goal`; a contact in none gets it cleared regardless of any
  stale stored value.
- **Existing tests** updated for the removed `goal` form field where referenced.
- `npm run test` and `npm run lint` are green.

- **Manual acceptance:**
  1. Run the `goals` table SQL in Supabase; set `POLLINATIONS_API_KEY` in
     `.env.local`.
  2. Insights: create a goal → card appears immediately, spinner, then AI image
     lands. Regenerate re-rolls.
  3. Open a goal → add existing people (search finds only existing contacts),
     remove a person, rename, delete.
  4. A person's detail panel shows their goals as chips; toggle membership from
     there (existing goals only).
  5. Add Person modal no longer has a free-text Goals field.
  6. Drafting a message for a goal member still reflects the goal in the AI
     context. Chat and the dashboard are unaffected.

## Acceptance criteria

- A `goals` table (per-user via Supabase) backs first-class goals with title,
  AI `image_url`, and `member_ids`.
- Creating a goal from Insights auto-generates a photo (server-side key, key-free
  stored URL), non-blocking, with a regenerate option and a gradient fallback.
- People can be associated with goals **only by picking existing contacts/goals** —
  the free-text goal input is gone.
- A person can belong to multiple goals; membership is editable from the goal
  detail modal and the person detail panel, both reading one source of truth.
- AI draft context still reflects a contact's goals via the derived `contact.goal`.
- `npm run test` and `npm run lint` pass.
