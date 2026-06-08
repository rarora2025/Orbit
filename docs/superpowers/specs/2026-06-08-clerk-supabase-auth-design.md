# Clerk Auth + Supabase Persistence + Slimmed Contact Model

**Date:** 2026-06-08
**Status:** Approved (design)

## Problem

The app is fully client-side: contacts live in a Zustand store persisted to
`localStorage`, seeded from `mockData.ts`. There is no auth and no backend, so
there are no real users and no per-user data. We want:

1. Real users via **Clerk** auth.
2. Per-user persistence via **Supabase** (a fresh user sees an empty board).
3. A **slimmed contact model** — only the fields that matter, with the rest of
   the app's fields and the pages built on them removed.

## Decisions (locked during brainstorming)

- **Strip to the core model everywhere** (not just "don't persist extras").
- **Data access = Approach 1**: server actions scope every query by Clerk
  `userId` using the Supabase service-role key; the browser never touches
  Supabase directly. RLS enabled as a backstop.
- **Add a `position` column** so the board preserves drag-to-reorder order
  across reloads and devices.
- **Delete the Outreach, Next Moves, and Insights pages** (they are built
  entirely on removed fields).
- **User has no Clerk/Supabase accounts** — the plan includes creating both
  from scratch.
- **`warmth` → `temperature`** rename across the code (user's vocabulary).
- **Clerk's hosted sign-in/sign-up UI** (not a custom form).

## Architecture

```
Browser (React + Zustand store, in-memory)
   │  calls
   ▼
Next.js Server Actions  ──auth() (Clerk) → userId──┐
   │  Supabase service-role client (server-only)   │
   ▼                                               │
Supabase Postgres: contacts (RLS on)  ◄── scoped: where user_id = userId
```

- **Auth:** `@clerk/nextjs`. `<ClerkProvider>` in the root layout;
  `clerkMiddleware()` in `middleware.ts` protects all app routes. Unauthenticated
  users are redirected to Clerk's hosted sign-in. After sign-in they land on the
  pipeline board. A user button (avatar + sign-out) lives in the sidebar.
- **Persistence:** one `contacts` table keyed by Clerk `user_id` (text).
- **Data access:** all reads/writes go through Next.js **server actions** in
  `src/lib/contacts.actions.ts`. Each action calls Clerk `auth()` to get the
  `userId`, then queries Supabase via a server-only admin client
  (`src/lib/supabase.ts`, service-role key), always scoped
  `where user_id = userId`. The browser never receives Supabase keys.
- **Client state:** the existing Zustand store remains but loses `localStorage`
  persistence and mock seeding. It is hydrated from the server on load
  (a client hydrator component fed by a server fetch) and updated optimistically
  on each mutation.

### Security note

The service-role key bypasses RLS, so isolation depends on every server action
scoping by `userId`. This is centralized in a single helper so it cannot be
forgotten. RLS is still enabled on the table with **no permissive policy**, so
any accidental use of the anon/authenticated key fails closed.

## Data model

Runtime `Contact` (in `src/lib/mockData.ts` → renamed conceptually to the
contact types module) and the Supabase `contacts` table both become:

| field         | type                               | source         |
| ------------- | ---------------------------------- | -------------- |
| `id`          | uuid (DB default `gen_random_uuid`)| DB             |
| `user_id`     | text (Clerk user id)               | system         |
| `name`        | text                               | user           |
| `company`     | text                               | user           |
| `status`      | `Send\|Pending\|Response\|Ghosted` | user (column)  |
| `score`       | int 0–100                          | AI-generated   |
| `temperature` | `Low\|Medium\|High`                | AI-generated   |
| `tags`        | text[] (expect ≤ 2)                | AI-generated   |
| `position`    | double precision                   | system (order) |
| `created_at`  | timestamptz default now()          | system         |
| `updated_at`  | timestamptz default now()          | system         |

**Removed everywhere** (type, UI, modal, map, store, tests):
`role, linkedinUrl, email, inquiry, notes, priority, avatarColor,
lastContacted, nextAction, actionNote, aiSummary, outreachAngle,
suggestedMessage, interactions`, plus the `Interaction` type and `Priority`
type. `warmth` is renamed to `temperature` (type `Temperature`).

`avatarColor` is no longer stored — the avatar color is derived deterministically
from the contact's name at render time (extend/use `cardVisuals.ts`).

### Supabase schema (SQL the user runs in the SQL editor)

```sql
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  company     text not null default '',
  status      text not null default 'Send',
  score       int  not null default 0,
  temperature text not null default 'Medium',
  tags        text[] not null default '{}',
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index contacts_user_id_idx on public.contacts (user_id);

alter table public.contacts enable row level security;
-- No permissive policy: only the service-role key (server actions) can read/write.
```

## AI generation seam (stubbed)

A single function `generateContactSignals(name, company)` returns
`{ score, temperature, tags }`. **For this build it is a deterministic
placeholder** (e.g. `score: 50, temperature: 'Medium', tags: []`) with a clear
`TODO` marking where the real LLM call goes (a separate follow-up project). It is
invoked:

- on **add** (a new contact gets generated signals), and
- when an **action changes a contact** (e.g. a status move re-generates signals),

so the "recalculate on action" behavior is wired even though the generator is a
stub. The function lives in its own module so the LLM swap touches one file.

## Data flow per operation

- **Load:** authenticated request → server fetch of `contacts` for `userId`
  (ordered by `status` then `position`) → client hydrator seeds the store.
- **Add:** client calls `addContact` action with `{ name, company, status }` →
  action computes `generateContactSignals`, assigns `position` (max in column
  + 1), inserts scoped row, returns it → store appends optimistically.
- **Update (edit name/company/status):** `updateContact` action writes scoped
  row; status-changing edits re-run `generateContactSignals`.
- **Move (drag reorder):** `moveContact` action recomputes `position` (placed
  between neighbors / appended) and `status`, writes scoped row.
- **Delete:** `deleteContact` action deletes scoped row.

All actions verify ownership by scoping on `user_id = userId`; an id that
doesn't belong to the user matches nothing.

## Pages & UI changes

- **Delete** `src/app/outreach`, `src/app/next-moves`, `src/app/insights` and
  their links in `Sidebar`.
- **Keep** the Pipeline board (`src/app/page.tsx`) and Map (`src/app/map`,
  `TopicMap` — drop its single `.role` use).
- **Add/Edit modal** (`ContactModal`) reduces to **name, company, status**.
  Score/temperature/tags are generated, not user-entered, so their inputs are
  removed.
- **ContactCard / ContactTable** stop rendering removed fields; show
  name, company, status, temperature, score, tags; avatar color derived.
- **Sidebar** gains the Clerk user button.

## Auth flow (Clerk)

- Packages: `@clerk/nextjs`.
- `<ClerkProvider>` wraps the root layout.
- `middleware.ts` uses `clerkMiddleware()` and protects all routes except the
  sign-in/sign-up catch-all routes and static assets.
- Hosted sign-in/sign-up pages (catch-all route segments).
- Env vars in `.env.local` (gitignored):
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

> **Next.js note:** this repo runs a modified Next.js (16.2.7) — see
> `AGENTS.md`. Implementation must read the relevant guides in
> `node_modules/next/dist/docs/` (middleware, server actions, route handlers)
> before writing code, since APIs may differ from upstream.

## Account setup (user-performed, with exact steps in the plan)

1. **Clerk:** create an application → copy publishable + secret keys.
2. **Supabase:** create a project → run the schema SQL above in the SQL editor →
   copy the project URL and the service-role key (Settings → API).
3. Paste all four values into `.env.local`.

## Testing

- **Unit:** `generateContactSignals` stub output; position/ordering math; the
  slimmed Zustand store reducers (rewrite `store.test.ts`); search over the new
  shape (`contactSearch.test.ts`).
- **Server actions:** unit tests with the Supabase client and Clerk `auth()`
  mocked, asserting every query is scoped by `userId` and that a foreign id
  cannot be mutated.
- **Manual acceptance:** sign up fresh → board is empty → add a contact → reload
  → it persists → sign in as a second account → sees nothing.

## Out of scope (future work)

- Real LLM-backed `generateContactSignals`.
- Hardening to Approach 3 (RLS via Clerk's native Supabase third-party auth).
- Realtime sync across open tabs.

## Acceptance criteria

- A new user signs up and sees an empty pipeline board.
- Adding/editing/moving/deleting contacts persists to Supabase and survives
  reload; data is strictly per-user.
- Only the slimmed fields exist in the type, table, and UI; the three removed
  pages and their links are gone.
- `npm run test` and `npm run lint` pass.
