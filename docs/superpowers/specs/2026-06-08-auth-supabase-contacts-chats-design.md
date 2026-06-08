# Auth + Supabase Persistence (Contacts & Chats) — Design

**Date:** 2026-06-08
**Status:** Draft (awaiting user review)
**Supersedes for this work:** the broader `2026-06-08-clerk-supabase-auth-design.md`
(that spec also slims the contact model and renames `warmth`→`temperature`, and
predates the V2 redesign; we are intentionally **not** following it here).

## Problem

The app is a single-user personal dashboard with no backend. Two Zustand stores
hold everything in the browser, persisted to `localStorage`:

- `store.ts` — **contacts**, seeded from `mockData.ts` (the full "fat" `Contact`
  model: `warmth`, `role`, `email`, `interactions`, `aiSummary`, etc.).
- `chatStore.ts` — **chat sessions** (Network Chat history).

There are no real users and no per-user data. We want:

1. Real users via **Clerk** (sign up / sign in / sign out, protected app).
2. Per-user persistence via **Supabase** for **both contacts and chat sessions**.
3. A brand-new user starts with a **completely empty** board and no chat history.

The current app surface is just two routes: **`/`** (the pipeline board) and
**`/chat`** (Network Chat). The Map / Outreach / Next Moves / Insights pages no
longer exist.

## Non-goals (explicitly out of scope)

- **No model changes.** The `Contact` shape stays exactly as it is today (fat
  model, `warmth` not `temperature`). The one unavoidable addition is a
  `position` field for durable board ordering (see Data model).
- **No AI work.** `buildReply()` in the chat stays the client-side prototype it
  is today. No LLM is wired up.
- **No onboarding flow.** The richer "onboard through the chat" experience is a
  separate later project. New users simply land on the existing empty states.
- **No data migration.** Existing `localStorage` data is throwaway; a clean
  start is expected.

## Decisions (locked during brainstorming)

- **Scope = full backend (B):** contacts *and* chats move to Supabase per-user.
- **Data access = server-side (Approach A):** the browser never talks to
  Supabase. All reads/writes go through Next.js **server actions** that read the
  Clerk `userId` via `auth()` and scope every query `where user_id = userId`,
  using the Supabase **service-role key** (server-only). RLS is enabled with no
  permissive policy as a fail-closed backstop.
- **New user → empty start**, throwaway local data.
- **Clerk's hosted sign-in/sign-up UI** (not a custom form).

## Architecture

```
Browser (React + two Zustand stores, in-memory, hydrated from server)
   │  calls
   ▼
Next.js Server Actions  ──auth() (Clerk) → userId──┐
   │  Supabase service-role client (server-only)   │
   ▼                                               │
Supabase Postgres                                  │
  • contacts       (RLS on, no policy)  ◄── scoped: where user_id = userId
  • chat_sessions  (RLS on, no policy)  ◄── scoped: where user_id = userId
```

- **Auth:** `@clerk/nextjs`. `<ClerkProvider>` wraps the root layout;
  `clerkMiddleware()` in `middleware.ts` protects all routes except the
  sign-in/sign-up catch-alls and static assets. Unauthenticated users are
  redirected to Clerk's hosted sign-in; after sign-in they land on the board.
- **App shell:** the Sidebar/`main` shell moves out of the root layout into an
  authed route group `src/app/(app)/` so the sign-in/up pages render without it.
  The hardcoded user block in `Sidebar` is replaced by Clerk's `<UserButton>`
  (avatar + sign-out) and the live signed-in name.
- **Persistence:** two tables keyed by Clerk `user_id` (text).
- **Client state:** both Zustand stores keep their in-memory shape but **lose
  `localStorage` persistence and mock seeding**. They are hydrated from the
  server on load and updated optimistically on each mutation, with the change
  also written through a server action.

### Security note

The service-role key bypasses RLS, so isolation depends on every server action
scoping by `userId`. This is centralized in a single `requireUserId()` helper so
it cannot be forgotten, and the service-role client lives in one
`import 'server-only'`-guarded module. RLS is enabled on both tables with **no
permissive policy**, so any accidental use of the anon/authenticated key fails
closed.

## Data model

**Storage choice: `jsonb` blob per row.** Because we are keeping the full fat
`Contact` / chat shapes unchanged, each row stores the app object as-is in a
`jsonb` column rather than mapping ~20 columns. This is the lowest-churn faithful
persistence of the current stores and needs no per-field migration. We never
query by inner fields in SQL — all filtering/search is already in-app.

Two top-level columns are promoted out of the blob because the server needs them:
`user_id` (scoping) and, for contacts, `position` (durable board order).

### `contacts`

| column       | type             | notes                                  |
| ------------ | ---------------- | -------------------------------------- |
| `id`         | text PK          | client-generated (as today)            |
| `user_id`    | text not null    | Clerk user id                          |
| `position`   | double precision | board ordering within a column         |
| `data`       | jsonb not null   | the full current `Contact` object      |
| `updated_at` | timestamptz      | default `now()`                        |

**One model addition:** `Contact` gains a `position: number` field. The board's
column order is currently implicit array order; to persist it across reloads and
devices we need an explicit, comparable value. Fractional positions let us insert
between neighbours without rewriting siblings. This is the only change to the
`Contact` type — no fields are removed or renamed.

### `chat_sessions`

| column       | type           | notes                                       |
| ------------ | -------------- | ------------------------------------------- |
| `id`         | text PK        | client-generated (as today)                 |
| `user_id`    | text not null  | Clerk user id                               |
| `title`      | text           | mirrors `ChatSession.title`                 |
| `messages`   | jsonb not null | array of `StoredMsg` (unchanged shape)      |
| `updated_at` | timestamptz    | default `now()`; drives history ordering    |

### Supabase schema (SQL the user runs in the SQL editor)

```sql
create table public.contacts (
  id         text primary key,
  user_id    text not null,
  position   double precision not null default 0,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create index contacts_user_id_idx on public.contacts (user_id);
alter table public.contacts enable row level security;
-- No permissive policy: only the service-role key (our server actions) may read/write.

create table public.chat_sessions (
  id         text primary key,
  user_id    text not null,
  title      text not null default '',
  messages   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index chat_sessions_user_id_idx on public.chat_sessions (user_id);
alter table public.chat_sessions enable row level security;
```

## Data flow per operation

**Contacts** (per-row writes; the store stays sorted by `position`):

- **Load:** authed request → server fetch of `contacts` for `userId`, ordered by
  `position` → client hydrator seeds `useCRMStore`.
- **Add:** server action assigns `position` (max in target column + step),
  inserts a scoped row with the full `Contact` in `data`, returns it → store
  appends optimistically.
- **Update (edit fields):** server action writes the scoped row's `data`.
- **Move (drag reorder):** server action recomputes `position` (placed between
  neighbours / appended) and `status`, writes the scoped row.
- **Delete:** server action deletes the scoped row.

**Chats** (whole-session upserts — simplest faithful sync for the array-shaped
chat store):

- **Load:** server fetch of `chat_sessions` for `userId`, ordered by
  `updated_at` desc → client hydrator seeds `useChatStore`.
- **Add user / assistant message, rename, new session:** after the local store
  mutation, an `upsertSession(session)` server action writes the full scoped row
  (`title`, `messages`, `updated_at`). Client-generated ids are kept, so the
  existing synchronous "return the session id" behaviour is preserved and the
  write fires in the background.
- **Delete session:** `deleteSession(id)` server action deletes the scoped row.

All actions verify ownership by scoping on `user_id = userId`; an id that does
not belong to the user matches nothing.

## Auth flow (Clerk)

- Package: `@clerk/nextjs`.
- `<ClerkProvider>` wraps the root layout.
- `middleware.ts` (location/matcher verified against the modified-Next docs) uses
  `clerkMiddleware()` and protects everything except `/sign-in(.*)`,
  `/sign-up(.*)`, and static assets.
- Hosted sign-in/sign-up pages at catch-all routes
  `src/app/sign-in/[[...sign-in]]/page.tsx` and `.../sign-up/...`.
- `Sidebar` swaps its hardcoded user for `<UserButton>` + live `useUser()` name.
- Env vars in `.env.local` (gitignored):
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

> **Modified Next.js note:** this repo runs a modified Next.js (16.2.7) — see
> `AGENTS.md`. Implementation MUST read the relevant guides in
> `node_modules/next/dist/docs/` (middleware, server actions, route handlers)
> before writing that code, since APIs may differ from upstream.

## Files (high level — the plan will enumerate exact steps)

**Create:**
- `middleware.ts` (repo root) — Clerk middleware.
- `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`.
- `src/app/(app)/layout.tsx` — authed shell (Sidebar + hydrator).
- `src/lib/supabase.ts` — server-only service-role client.
- `src/lib/contacts.actions.ts` (+ test) — contact server actions, userId-scoped.
- `src/lib/chats.actions.ts` (+ test) — chat server actions, userId-scoped.
- `src/components/StoreHydrator.tsx` — seeds both stores from the server on mount.

**Modify:**
- `src/app/layout.tsx` — add `<ClerkProvider>`, move shell into `(app)`.
- `src/lib/store.ts` — drop `localStorage`/mock seed; add `position`, hydrate +
  async server-backed mutations.
- `src/lib/chatStore.ts` — drop `localStorage`; hydrate + background upserts.
- `src/lib/mockData.ts` — keep the **types** (`Contact`, `Status`, etc.); remove
  the `mockContacts` seed array (the empty store no longer needs it). Add
  `position` to the `Contact` interface.
- `src/components/Sidebar.tsx` — Clerk `<UserButton>` + live user name.
- `src/app/page.tsx` → `src/app/(app)/page.tsx`; chat route likewise into `(app)`.

## Account setup (user-performed; exact steps in the plan)

1. **Clerk:** create an application → copy publishable + secret keys.
2. **Supabase:** create a project → run the schema SQL above → copy the project
   URL and the **service_role** key (Settings → API).
3. Paste all four values into `.env.local`.

## Testing

- **Unit:** position/ordering math; store reducers (hydrate + optimistic
  apply) for both stores; existing contact-search tests still pass against the
  unchanged shape.
- **Server actions:** unit tests with the Supabase client and Clerk `auth()`
  mocked, asserting every read/write is scoped by `userId`, a missing user is
  rejected, and a foreign id cannot be mutated — for both contacts and chats.
- **Manual acceptance:**
  1. Sign up as a brand-new user → board and chat history are **empty**.
  2. Add a contact → it appears; reload → it persists; drag-reorder → order
     survives reload.
  3. Start a chat, send messages → reload → the conversation persists.
  4. Sign out, sign up as a second user → sees **none** of the first user's
     contacts or chats.

## Acceptance criteria

- A new user signs up and sees an empty pipeline board and empty chat history.
- Adding/editing/moving/deleting contacts and creating/continuing/deleting chats
  persist to Supabase and survive reload; data is strictly per-user.
- The `Contact` model is unchanged except for the added `position` field; no
  fields renamed or removed; the chat `StoredMsg`/`ChatSession` shapes are
  unchanged.
- The browser never receives Supabase keys; all DB access is server-side.
- `npm run test` and `npm run lint` pass.
```
