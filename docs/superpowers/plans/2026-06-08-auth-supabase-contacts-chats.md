# Auth + Supabase Persistence (Contacts & Chats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk auth and per-user Supabase persistence for **both contacts and chat sessions**, leaving the current fat data model intact, so a new user signs in and starts with an empty board and empty chat history that persist across reloads and devices.

**Architecture:** The two Zustand stores keep their in-memory shape but lose `localStorage`/mock seeding. They are hydrated on load and mutated optimistically; every change is written through Next.js **server actions** that read the Clerk `userId` via `auth()` and scope every query `where user_id = userId` using the Supabase **service-role key** (server-only). Each row stores the unchanged app object in a `jsonb` column; contacts also carry a `position` column for durable board order.

**Tech Stack:** Next.js 16.2.7 (App Router, **modified — read `node_modules/next/dist/docs/` before writing middleware/server actions**), React 19, Zustand 5, `@clerk/nextjs`, `@supabase/supabase-js`, Vitest 2, Tailwind 4.

**Source of truth:** `docs/superpowers/specs/2026-06-08-auth-supabase-contacts-chats-design.md`.

**Phases (each ends with working, committed software):**
1. In-memory stores + durable `position` ordering + empty start (no auth/backend yet).
2. Clerk auth: provider, middleware, sign-in/up, authed route group, sidebar user button.
3. Supabase persistence: schema, server actions (contacts + chats) scoped by `userId`, async stores, hydrator.

---

## File Structure

**Create:**
- `src/lib/supabase.ts` — server-only service-role client (Phase 3).
- `src/lib/contacts.actions.ts` (+ `.test.ts`) — contact server actions, userId-scoped (Phase 3).
- `src/lib/chats.actions.ts` (+ `.test.ts`) — chat server actions, userId-scoped (Phase 3).
- `src/components/StoreHydrator.tsx` — seeds both stores from the server on mount (Phase 3).
- `src/app/(app)/layout.tsx` — authed shell (Sidebar + hydrator) (Phase 2/3).
- `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx` (Phase 2).
- `middleware.ts` (repo root) — Clerk middleware (Phase 2).
- `src/lib/chatStore.test.ts` — chat store reducer tests (Phase 1).

**Modify:**
- `src/lib/position.ts` — make ordering helpers structural so they accept the fat `Contact` (Phase 1).
- `src/lib/mockData.ts` — add `position` to `Contact`; remove the `mockContacts` seed + `getContactById` (Phase 1).
- `src/components/ContactModal.tsx` — set `position: 0` on new contacts; use `crypto.randomUUID()` for ids (Phase 1).
- `src/lib/store.ts` (+ `store.test.ts`) — in-memory + `position` + `setContacts`/`loaded`; async server-backed mutations (Phase 1 then Phase 3).
- `src/lib/chatStore.ts` — drop `localStorage`; `setSessions`; uuid ids; background upserts (Phase 1 then Phase 3).
- `src/app/layout.tsx` — add `<ClerkProvider>`, move shell into `(app)` (Phase 2).
- `src/components/Sidebar.tsx` — Clerk `<UserButton>` + live user name (Phase 2).
- `src/app/page.tsx` → `src/app/(app)/page.tsx`; `src/app/chat/` → `src/app/(app)/chat/` (Phase 2).

**Delete:**
- `src/lib/contact.ts`, `src/lib/contactSignals.ts`, `src/lib/contactSignals.test.ts` — dead slim-model remnants (Phase 1).

---

# Phase 1 — In-memory stores, durable ordering, empty start

The app keeps working throughout. By the end: board and chat render **empty**, adding a contact works in-memory (lost on reload — persistence is Phase 3), and board order is tracked by a numeric `position`.

### Task 1.1: Make the ordering helpers structural

`src/lib/position.ts` currently types to the slim `./contact` model. Re-type it to a minimal structural shape so it works with the fat `Contact` from `mockData.ts` (which lacks `temperature`). The existing `position.test.ts` keeps passing unchanged.

**Files:**
- Modify: `src/lib/position.ts`

- [ ] **Step 1: Replace the file** `src/lib/position.ts`

```ts
// Minimal shape the ordering math needs — works with any contact-like record
// that carries an id, a board status, and a numeric position. Kept structural so
// both the app's Contact and test fixtures satisfy it without a shared type.
interface Positioned {
  id: string;
  status: string;
  position: number;
}

const STEP = 1000;

/** Position for a new card appended to the end of its column. */
export function appendPosition<T extends Positioned>(contacts: T[], status: string): number {
  const inColumn = contacts.filter(c => c.status === status);
  if (inColumn.length === 0) return STEP;
  return inColumn.reduce((m, c) => Math.max(m, c.position), 0) + STEP;
}

/**
 * Position that places `movingId` immediately before `beforeId` within
 * `status`. When `beforeId` is null or not found, the card is appended to the
 * end of the column.
 */
export function positionBefore<T extends Positioned>(
  contacts: T[],
  status: string,
  beforeId: string | null,
  movingId: string,
): number {
  const column = contacts
    .filter(c => c.status === status && c.id !== movingId)
    .sort((a, b) => a.position - b.position);

  if (!beforeId) {
    return column.length === 0 ? STEP : column[column.length - 1].position + STEP;
  }
  const idx = column.findIndex(c => c.id === beforeId);
  if (idx === -1) {
    return column.length === 0 ? STEP : column[column.length - 1].position + STEP;
  }
  const prev = idx === 0 ? 0 : column[idx - 1].position;
  const next = column[idx].position;
  // Fractional indexing: midpoint between neighbours. Gaps shrink with each
  // successive insert at the same spot; at CRM column sizes this is safe.
  return (prev + next) / 2;
}

/** Ascending order by `position` (column grouping is the caller's job). */
export function sortByPosition<T extends Positioned>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => a.position - b.position);
}
```

- [ ] **Step 2: Run the existing tests**

Run: `npx vitest run src/lib/position.test.ts`
Expected: PASS (the slim fixtures in that test satisfy `Positioned`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/position.ts
git commit -m "refactor: make position helpers structural"
```

### Task 1.2: Add `position` to the contact model; drop the mock seed

**Files:**
- Modify: `src/lib/mockData.ts`
- Modify: `src/components/ContactModal.tsx`

- [ ] **Step 1: Add `position` to the `Contact` interface** in `src/lib/mockData.ts`

Find the `Contact` interface and add a `position` field (place it right after `id`):

```ts
export interface Contact {
  id: string;
  position: number;        // ordering within a board column (durable across reloads)
  name: string;
  company: string;
  // ...all existing fields unchanged...
```

- [ ] **Step 2: Remove the mock seed and its helper.** Delete the entire `export const mockContacts: Contact[] = [ ... ];` array, and delete the `getContactById` helper at the bottom that calls `mockContacts.find(...)`. Keep every **type** export (`Contact`, `Status`, `Priority`, `Warmth`, `Interaction`) and `columnConfig` and any other non-seed exports.

- [ ] **Step 3: Update `ContactModal.tsx`** so the contact it builds satisfies the new type. In `src/components/ContactModal.tsx`, change the id line and add `position`:

Replace:
```tsx
    const newContact: Contact = {
      id: Date.now().toString(),
      name: form.name.trim(),
```
with:
```tsx
    const newContact: Contact = {
      id: crypto.randomUUID(),
      position: 0, // placeholder; the store/server assigns the real column position
      name: form.name.trim(),
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `src/lib/store.ts` (it still imports `mockContacts`) — that file is rewritten in Task 1.3. No errors in `mockData.ts` or `ContactModal.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mockData.ts src/components/ContactModal.tsx
git commit -m "feat: add position to Contact; remove mock seed"
```

### Task 1.3: Rewrite the contact store as in-memory + position-ordered

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/store.test.ts`

- [ ] **Step 1: Replace `src/lib/store.test.ts`** with tests for the in-memory reducers

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCRMStore } from './store';
import type { Contact } from './mockData';

function c(id: string, status: Contact['status'], position: number): Contact {
  return {
    id, position, name: id, company: '', role: '', linkedinUrl: '', email: '',
    inquiry: '', notes: '', status, priority: 'Medium', score: 0, warmth: 'Medium',
    avatarColor: '', tags: [], lastContacted: '', nextAction: '', aiSummary: '',
    outreachAngle: '', suggestedMessage: '', interactions: [],
  };
}

beforeEach(() => {
  useCRMStore.setState({ contacts: [], selectedContactId: null, loaded: false });
});

describe('useCRMStore (in-memory)', () => {
  it('setContacts sorts by position and marks loaded', () => {
    useCRMStore.getState().setContacts([c('b', 'Send', 2000), c('a', 'Send', 1000)]);
    expect(useCRMStore.getState().contacts.map(x => x.id)).toEqual(['a', 'b']);
    expect(useCRMStore.getState().loaded).toBe(true);
  });

  it('addContact appends after the last card in its column', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000)]);
    useCRMStore.getState().addContact(c('b', 'Send', 0));
    const b = useCRMStore.getState().contacts.find(x => x.id === 'b')!;
    expect(b.position).toBe(2000);
  });

  it('moveContact repositions between neighbours and updates status', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000), c('b', 'Send', 2000)]);
    useCRMStore.getState().moveContact('b', 'Send', 'a');
    const b = useCRMStore.getState().contacts.find(x => x.id === 'b')!;
    expect(b.position).toBe(500);
  });

  it('deleteContact drops the contact and clears selection', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000)]);
    useCRMStore.setState({ selectedContactId: 'a' });
    useCRMStore.getState().deleteContact('a');
    expect(useCRMStore.getState().contacts).toEqual([]);
    expect(useCRMStore.getState().selectedContactId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/store.test.ts`
Expected: FAIL — `setContacts`/`loaded` not defined (and the old `mockContacts` import is gone).

- [ ] **Step 3: Replace `src/lib/store.ts`** with the in-memory store

```ts
'use client';

import { create } from 'zustand';
import { Contact, Status } from './mockData';
import { appendPosition, positionBefore, sortByPosition } from './position';

interface CRMStore {
  contacts: Contact[];
  loaded: boolean;
  selectedContactId: string | null;
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  moveContact: (id: string, toStatus: Status, beforeId: string | null) => void;
  deleteContact: (id: string) => void;
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>()((set) => ({
  contacts: [],
  loaded: false,
  selectedContactId: null,
  setContacts: (contacts) => set({ contacts: sortByPosition(contacts), loaded: true }),
  addContact: (contact) =>
    set((s) => ({
      contacts: sortByPosition([
        ...s.contacts,
        { ...contact, position: appendPosition(s.contacts, contact.status) },
      ]),
    })),
  updateContact: (id, updates) =>
    set((s) => ({
      contacts: sortByPosition(
        s.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      ),
    })),
  moveContact: (id, toStatus, beforeId) =>
    set((s) => {
      const moving = s.contacts.find((c) => c.id === id);
      if (!moving) return {};
      const position = positionBefore(s.contacts, toStatus, beforeId, id);
      return {
        contacts: sortByPosition(
          s.contacts.map((c) => (c.id === id ? { ...c, status: toStatus, position } : c)),
        ),
      };
    }),
  deleteContact: (id) =>
    set((s) => ({
      contacts: s.contacts.filter((c) => c.id !== id),
      selectedContactId: s.selectedContactId === id ? null : s.selectedContactId,
    })),
  selectContact: (id) => set({ selectedContactId: id }),
}));
```

> The public method names (`addContact`/`updateContact`/`moveContact`/`deleteContact`/`selectContact`) are unchanged, so `src/app/page.tsx` needs no edits in this phase. Phase 3 makes these call server actions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "refactor: in-memory contact store with position ordering"
```

### Task 1.4: Rewrite the chat store as in-memory + add `setSessions`

**Files:**
- Modify: `src/lib/chatStore.ts`
- Create: `src/lib/chatStore.test.ts`

- [ ] **Step 1: Write the failing test** `src/lib/chatStore.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './chatStore';

beforeEach(() => {
  useChatStore.setState({ sessions: [], activeId: null });
});

describe('useChatStore (in-memory)', () => {
  it('setSessions hydrates the list', () => {
    useChatStore.getState().setSessions([
      { id: '1', title: 'Hi', messages: [], updatedAt: 1 },
    ]);
    expect(useChatStore.getState().sessions).toHaveLength(1);
  });

  it('addUserMessage creates a session and returns its id', () => {
    const id = useChatStore.getState().addUserMessage('first message');
    const s = useChatStore.getState().sessions.find(x => x.id === id)!;
    expect(s.messages).toEqual([{ role: 'user', text: 'first message' }]);
    expect(useChatStore.getState().activeId).toBe(id);
  });

  it('addUserMessage appends to the active session', () => {
    const id = useChatStore.getState().addUserMessage('one');
    const id2 = useChatStore.getState().addUserMessage('two');
    expect(id2).toBe(id);
    expect(useChatStore.getState().sessions[0].messages).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chatStore.test.ts`
Expected: FAIL — `setSessions` not defined.

- [ ] **Step 3: Replace `src/lib/chatStore.ts`** — drop `persist`/`localStorage`, add `setSessions`, use `crypto.randomUUID()` for session ids

```ts
'use client';

import { create } from 'zustand';

// Messages store contact *ids* (not full objects) so they stay in sync with the
// CRM store and survive serialization; the UI re-resolves them at render time.
export type StoredMsg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; contactIds?: string[]; followups?: string[] };

export interface ChatSession {
  id: string;
  title: string;
  messages: StoredMsg[];
  updatedAt: number;
}

interface ChatStore {
  sessions: ChatSession[];
  activeId: string | null;
  setSessions: (sessions: ChatSession[]) => void;
  newChat: () => void;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  /** Appends to the active session, creating one if needed. Returns its id. */
  addUserMessage: (text: string) => string;
  addAssistantMessage: (sessionId: string, msg: Extract<StoredMsg, { role: 'assistant' }>) => void;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  sessions: [],
  activeId: null,
  setSessions: (sessions) => set({ sessions }),
  newChat: () => set({ activeId: null }),
  selectChat: (id) => set({ activeId: id }),
  deleteChat: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((x) => x.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    })),
  addUserMessage: (text) => {
    const s = get();
    const existing = s.activeId ? s.sessions.find((x) => x.id === s.activeId) : undefined;
    if (existing) {
      set({
        sessions: s.sessions.map((x) =>
          x.id === existing.id
            ? { ...x, messages: [...x.messages, { role: 'user', text }], updatedAt: Date.now() }
            : x,
        ),
      });
      return existing.id;
    }
    const id = crypto.randomUUID();
    const session: ChatSession = {
      id,
      title: text.length > 40 ? text.slice(0, 40).trimEnd() + '…' : text,
      messages: [{ role: 'user', text }],
      updatedAt: Date.now(),
    };
    set({ sessions: [session, ...s.sessions], activeId: id });
    return id;
  },
  addAssistantMessage: (sessionId, msg) =>
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId ? { ...x, messages: [...x.messages, msg], updatedAt: Date.now() } : x,
      ),
    })),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chatStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chatStore.ts src/lib/chatStore.test.ts
git commit -m "refactor: in-memory chat store with hydration hook"
```

### Task 1.5: Delete dead slim-model remnants + full Phase-1 verification

**Files:**
- Delete: `src/lib/contact.ts`, `src/lib/contactSignals.ts`, `src/lib/contactSignals.test.ts`

- [ ] **Step 1: Confirm nothing app-side imports them** (only their own tests should match)

Run: `git grep -n "lib/contact'\|/contactSignals\|from './contact'" -- src ':!src/lib/contact.ts' ':!src/lib/contactSignals.ts'`
Expected: no matches (Task 1.1 removed `position.ts`'s import of `./contact`).

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/contact.ts src/lib/contactSignals.ts src/lib/contactSignals.test.ts
```

- [ ] **Step 3: Full verification**

Run: `npm run test && npm run lint && npm run build`
Expected: all PASS. Then `npm run dev`, open `/`: the board renders **empty**; "Add person" creates an in-memory card; drag reorders it; `/chat` shows the empty state. (Reload clears data — persistence is Phase 3.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead slim-model modules"
```

---

# Phase 2 — Clerk authentication

The app now requires sign-in. The board/chat are still the in-memory stores (persistence is Phase 3).

### Task 2.1: Create the Clerk application (user-performed)

- [ ] **Step 1:** Go to https://dashboard.clerk.com → **Create application**. Name it (e.g. "Orbit"). Enable **Email** and any social providers you want. Click **Create**.
- [ ] **Step 2:** On the **API Keys** page, copy the **Publishable key** and **Secret key**.
- [ ] **Step 3:** Create `.env.local` in the repo root (gitignored via `.env*`) with:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### Task 2.2: Read the modified-Next docs, then install Clerk

**Files:** `package.json`

- [ ] **Step 1: Read the middleware guide** for this modified Next.js (AGENTS.md mandate)

Run: `ls node_modules/next/dist/docs/ && git grep -rl "clerkMiddleware\|middleware" node_modules/next/dist/docs/ | head`
Read the middleware doc it points to. Confirm the `middleware.ts` location (repo root vs `src/`) and the `config.matcher` shape this version expects. Note anything that differs from the code in Task 2.4 and adapt.

- [ ] **Step 2: Install Clerk**

Run: `npm install @clerk/nextjs`
Expected: installs without peer-dependency errors. If it warns about React 19 / Next 16 peers, note it; proceed only if install succeeds. Do **not** force-install.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @clerk/nextjs"
```

### Task 2.3: ClerkProvider in the root layout (shell moves out)

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx`** — wrap in `<ClerkProvider>` and remove the Sidebar/`main` shell (it moves to the authed route group in Task 2.5):

```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pursuit CRM",
  description: "AI-powered relationship manager for ambitious founders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable} h-full antialiased`}>
        <body className="h-full bg-[#faf9f5] font-sans">{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2:** Do not build yet — routes move in Task 2.5. Commit together in 2.5.

### Task 2.4: Middleware + hosted sign-in/up pages

**Files:**
- Create: `middleware.ts` (repo root)
- Create: `src/app/sign-in/[[...sign-in]]/page.tsx`
- Create: `src/app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Create `middleware.ts`** (verify the matcher/shape against the docs read in 2.2)

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

- [ ] **Step 2: Create `src/app/sign-in/[[...sign-in]]/page.tsx`**

```tsx
import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
      <SignIn />
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/sign-up/[[...sign-up]]/page.tsx`**

```tsx
import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
      <SignUp />
    </div>
  );
}
```

### Task 2.5: Move the app pages into an authed route group

The `(app)` route group does not change URLs (`/` and `/chat` stay the same) but lets the authed pages share the Sidebar shell while sign-in/up render bare.

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Move: `src/app/page.tsx` → `src/app/(app)/page.tsx`; `src/app/chat/` → `src/app/(app)/chat/`

- [ ] **Step 1: Move the pages**

```bash
mkdir -p "src/app/(app)"
git mv src/app/page.tsx "src/app/(app)/page.tsx"
git mv src/app/chat "src/app/(app)/chat"
```

- [ ] **Step 2: Create `src/app/(app)/layout.tsx`** with the shell moved out of the old root layout (same markup as before)

```tsx
import Sidebar from "@/components/Sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col h-full">
      <Sidebar />
      <main className="flex-1 mt-[4.75rem] px-3 pb-3 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify build + auth flow**

Run: `npm run build && npm run dev`
Expected: visiting `/` while signed out redirects to Clerk's `/sign-in`; signing up lands back on the board; `/chat` works when signed in.

- [ ] **Step 4: Commit (2.3–2.5 together)**

```bash
git add -A
git commit -m "feat: Clerk auth — provider, middleware, sign-in/up, authed route group"
```

### Task 2.6: Clerk user button in the sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Update the imports** at the top of `src/components/Sidebar.tsx`

Replace:
```tsx
import { LayoutGrid, MessageCircle, ChevronDown } from 'lucide-react';
import OrbitLogo from './OrbitLogo';
```
with:
```tsx
import { LayoutGrid, MessageCircle } from 'lucide-react';
import { UserButton, useUser } from '@clerk/nextjs';
import OrbitLogo from './OrbitLogo';
```

- [ ] **Step 2: Replace the placeholder profile `<button>...</button>`** (the block commented `{/* Profile — placeholder until Clerk is wired up */}`) with Clerk's user button + live name:

```tsx
      {/* Profile */}
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <UserName />
        <UserButton
          appearance={{ elements: { rootBox: 'w-7 h-7', avatarBox: 'w-7 h-7' } }}
        />
      </div>
```

- [ ] **Step 3: Add the `UserName` subcomponent** at the bottom of the file (after the default export)

```tsx
function UserName() {
  const { user } = useUser();
  if (!user) return null;
  return (
    <span className="hidden sm:block text-[13px] font-medium text-stone-700 whitespace-nowrap leading-none">
      {user.fullName ?? user.primaryEmailAddress?.emailAddress ?? 'Account'}
    </span>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: PASS; the bar shows the Clerk avatar + signed-in name; clicking it offers **Sign out**.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: Clerk user button in sidebar"
```

---

# Phase 3 — Supabase persistence (contacts + chats)

Replace the in-memory mutations with server actions scoped by the Clerk `userId`. Fresh users see empty board + chat; data persists across reloads and is strictly per-user.

### Task 3.1: Create the Supabase project + schema (user-performed)

- [ ] **Step 1:** Go to https://supabase.com/dashboard → **New project**. Pick a name + DB password + region. Wait for provisioning.
- [ ] **Step 2:** Open **SQL Editor** → **New query** → paste and **Run**:

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

- [ ] **Step 3:** Go to **Project Settings → API**. Copy the **Project URL** and the **service_role** secret. Append to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # service_role — server only, never expose
```

### Task 3.2: Install supabase-js + server-only admin client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Install**

Run: `npm install @supabase/supabase-js`

- [ ] **Step 2: Create `src/lib/supabase.ts`**

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Server-only Supabase client using the service-role key. NEVER import this into
 * a client component — it bypasses RLS. Every query MUST be scoped by the
 * caller's Clerk userId (see *.actions.ts).
 */
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts
git commit -m "feat: add server-only Supabase admin client"
```

### Task 3.3: Contact server actions, scoped by Clerk userId (TDD on scoping)

**Files:**
- Create: `src/lib/contacts.actions.ts`
- Test: `src/lib/contacts.actions.test.ts`

- [ ] **Step 1: Read the server-actions doc** for this modified Next.js (AGENTS.md mandate)

Run: `git grep -rl "use server\|Server Actions" node_modules/next/dist/docs/ | head`
Read it; confirm the `'use server'` module conventions for this version.

- [ ] **Step 2: Write the failing test** `src/lib/contacts.actions.test.ts` — assert reads/writes are scoped by `userId` and a missing user is rejected (Supabase + Clerk `auth` mocked)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const insert = vi.fn();
const del = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ data: [], error: null });
  eq.mockReturnValue({ order, eq, select });
  select.mockReturnValue({ eq, order });
  del.mockReturnValue({ eq });
  insert.mockReturnValue({ select: () => ({ single: () => ({ data: {}, error: null }) }) });
  from.mockReturnValue({ select, insert, delete: del });
});

describe('listContacts', () => {
  it('throws when there is no signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { listContacts } = await import('./contacts.actions');
    await expect(listContacts()).rejects.toThrow(/auth/i);
  });

  it('scopes the read to the Clerk userId', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { listContacts } = await import('./contacts.actions');
    await listContacts();
    expect(from).toHaveBeenCalledWith('contacts');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
  });
});

describe('deleteContact', () => {
  it('scopes the delete to the userId and the id', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { deleteContact } = await import('./contacts.actions');
    await deleteContact('contact_1');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 'contact_1');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/contacts.actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/lib/contacts.actions.ts`**

```ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import type { Contact, Status } from './mockData';
import { appendPosition, positionBefore } from './position';

interface Row {
  id: string;
  position: number;
  data: Contact;
}

function rowToContact(r: Row): Contact {
  // The full contact lives in `data`; id/position are authoritative columns.
  return { ...r.data, id: r.id, position: r.position };
}

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export async function listContacts(): Promise<Contact[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('id, position, data')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(rowToContact);
}

export async function addContact(contact: Contact): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const position = appendPosition(existing, contact.status);
  const stored: Contact = { ...contact, position };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({ id: stored.id, user_id: userId, position, data: stored })
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find((c) => c.id === id);
  if (!current) throw new Error('Contact not found');
  const merged: Contact = { ...current, ...updates, id, position: current.position };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

export async function moveContact(id: string, toStatus: Status, beforeId: string | null): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find((c) => c.id === id);
  if (!current) throw new Error('Contact not found');
  const position = positionBefore(existing, toStatus, beforeId, id);
  const merged: Contact = { ...current, status: toStatus, position };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ position, data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

export async function deleteContact(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/contacts.actions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contacts.actions.ts src/lib/contacts.actions.test.ts
git commit -m "feat: contact server actions scoped by Clerk userId"
```

### Task 3.4: Chat server actions, scoped by Clerk userId (TDD on scoping)

**Files:**
- Create: `src/lib/chats.actions.ts`
- Test: `src/lib/chats.actions.test.ts`

- [ ] **Step 1: Write the failing test** `src/lib/chats.actions.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const upsert = vi.fn();
const del = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ data: [], error: null });
  eq.mockReturnValue({ order, eq });
  select.mockReturnValue({ eq });
  upsert.mockResolvedValue({ error: null });
  del.mockReturnValue({ eq });
  from.mockReturnValue({ select, upsert, delete: del });
});

describe('listSessions', () => {
  it('throws when there is no signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { listSessions } = await import('./chats.actions');
    await expect(listSessions()).rejects.toThrow(/auth/i);
  });

  it('scopes the read to the Clerk userId', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { listSessions } = await import('./chats.actions');
    await listSessions();
    expect(from).toHaveBeenCalledWith('chat_sessions');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
  });
});

describe('upsertSession', () => {
  it('writes a row carrying the userId', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { upsertSession } = await import('./chats.actions');
    await upsertSession({ id: 's1', title: 'Hi', messages: [], updatedAt: 1000 });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', user_id: 'user_123', title: 'Hi' }),
    );
  });
});

describe('deleteSession', () => {
  it('scopes the delete to the userId and the id', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { deleteSession } = await import('./chats.actions');
    await deleteSession('s1');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 's1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chats.actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/chats.actions.ts`**

```ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabase';
import type { ChatSession, StoredMsg } from './chatStore';

interface Row {
  id: string;
  title: string;
  messages: StoredMsg[];
  updated_at: string;
}

function rowToSession(r: Row): ChatSession {
  return { id: r.id, title: r.title, messages: r.messages, updatedAt: new Date(r.updated_at).getTime() };
}

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export async function listSessions(): Promise<ChatSession[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, title, messages, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(rowToSession);
}

export async function upsertSession(session: ChatSession): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabaseAdmin
    .from('chat_sessions')
    .upsert({
      id: session.id,
      user_id: userId,
      title: session.title,
      messages: session.messages,
      updated_at: new Date(session.updatedAt).toISOString(),
    });
  if (error) throw error;
}

export async function deleteSession(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabaseAdmin
    .from('chat_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chats.actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chats.actions.ts src/lib/chats.actions.test.ts
git commit -m "feat: chat server actions scoped by Clerk userId"
```

### Task 3.5: Connect the stores to the server actions

The contact store awaits the server (authoritative position) then applies the returned row. The chat store keeps its synchronous local mutations and fires the matching upsert/delete in the background, so the existing `addUserMessage` return-id contract is preserved.

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/chatStore.ts`

- [ ] **Step 1: Update `src/lib/store.ts`** — keep the in-memory `apply` logic as private reducers and make the public mutations call the server. Replace the store creator with:

```ts
'use client';

import { create } from 'zustand';
import { Contact, Status } from './mockData';
import { sortByPosition } from './position';
import * as api from './contacts.actions';

interface CRMStore {
  contacts: Contact[];
  loaded: boolean;
  selectedContactId: string | null;
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => Promise<void>;
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
  moveContact: (id: string, toStatus: Status, beforeId: string | null) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>()((set, get) => {
  const upsertLocal = (contact: Contact) =>
    set((s) => ({
      contacts: sortByPosition([
        ...s.contacts.filter((c) => c.id !== contact.id),
        contact,
      ]),
    }));

  return {
    contacts: [],
    loaded: false,
    selectedContactId: null,
    setContacts: (contacts) => set({ contacts: sortByPosition(contacts), loaded: true }),
    addContact: async (contact) => { upsertLocal(await api.addContact(contact)); },
    updateContact: async (id, updates) => { upsertLocal(await api.updateContact(id, updates)); },
    moveContact: async (id, toStatus, beforeId) => { upsertLocal(await api.moveContact(id, toStatus, beforeId)); },
    deleteContact: async (id) => {
      await api.deleteContact(id);
      set((s) => ({
        contacts: s.contacts.filter((c) => c.id !== id),
        selectedContactId: s.selectedContactId === id ? null : s.selectedContactId,
      }));
    },
    selectContact: (id) => set({ selectedContactId: id }),
  };
});
```

- [ ] **Step 2: Update `src/lib/store.test.ts`** — the store now imports `contacts.actions` (which pulls in the `server-only`-guarded Supabase client). Mock that module so the test environment never loads it, and focus the test on the pure `setContacts` hydration (mutations are covered by the action tests). Replace the file with:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./contacts.actions', () => ({
  addContact: vi.fn(),
  updateContact: vi.fn(),
  moveContact: vi.fn(),
  deleteContact: vi.fn(),
  listContacts: vi.fn(),
}));

import { useCRMStore } from './store';
import type { Contact } from './mockData';

function c(id: string, status: Contact['status'], position: number): Contact {
  return {
    id, position, name: id, company: '', role: '', linkedinUrl: '', email: '',
    inquiry: '', notes: '', status, priority: 'Medium', score: 0, warmth: 'Medium',
    avatarColor: '', tags: [], lastContacted: '', nextAction: '', aiSummary: '',
    outreachAngle: '', suggestedMessage: '', interactions: [],
  };
}

beforeEach(() => {
  useCRMStore.setState({ contacts: [], selectedContactId: null, loaded: false });
});

describe('useCRMStore hydration', () => {
  it('setContacts sorts by position and marks loaded', () => {
    useCRMStore.getState().setContacts([c('b', 'Send', 2000), c('a', 'Send', 1000)]);
    expect(useCRMStore.getState().contacts.map((x) => x.id)).toEqual(['a', 'b']);
    expect(useCRMStore.getState().loaded).toBe(true);
  });

  it('selectContact toggles the selection', () => {
    useCRMStore.getState().selectContact('a');
    expect(useCRMStore.getState().selectedContactId).toBe('a');
  });
});
```

- [ ] **Step 3: Run the store test**

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 4: Update `src/lib/chatStore.ts`** — fire background writes after each local mutation. Add the import and wrap the relevant actions:

Add at the top, below the existing imports:
```ts
import * as api from './chats.actions';
```

In `deleteChat`, after the `set(...)`, fire the server delete:
```ts
  deleteChat: (id) => {
    set((s) => ({
      sessions: s.sessions.filter((x) => x.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    }));
    void api.deleteSession(id);
  },
```

In `addUserMessage`, after each `set(...)` and before the `return`, persist the affected session. Replace the body with:
```ts
  addUserMessage: (text) => {
    const s = get();
    const existing = s.activeId ? s.sessions.find((x) => x.id === s.activeId) : undefined;
    if (existing) {
      const updated = { ...existing, messages: [...existing.messages, { role: 'user' as const, text }], updatedAt: Date.now() };
      set({ sessions: s.sessions.map((x) => (x.id === existing.id ? updated : x)) });
      void api.upsertSession(updated);
      return existing.id;
    }
    const id = crypto.randomUUID();
    const session: ChatSession = {
      id,
      title: text.length > 40 ? text.slice(0, 40).trimEnd() + '…' : text,
      messages: [{ role: 'user', text }],
      updatedAt: Date.now(),
    };
    set({ sessions: [session, ...s.sessions], activeId: id });
    void api.upsertSession(session);
    return id;
  },
```

In `addAssistantMessage`, persist the updated session:
```ts
  addAssistantMessage: (sessionId, msg) => {
    const updated = get().sessions
      .map((x) => (x.id === sessionId ? { ...x, messages: [...x.messages, msg], updatedAt: Date.now() } : x))
      .find((x) => x.id === sessionId);
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId ? { ...x, messages: [...x.messages, msg], updatedAt: Date.now() } : x,
      ),
    }));
    if (updated) void api.upsertSession(updated);
  },
```

- [ ] **Step 5: Mock the actions module in `src/lib/chatStore.test.ts`.** The chat store now imports `chats.actions` (which pulls in the `server-only`-guarded Supabase client), so the test must mock it or the import throws. Add this at the very top of `src/lib/chatStore.test.ts`, above the existing imports:

```ts
import { vi } from 'vitest';

vi.mock('./chats.actions', () => ({
  upsertSession: vi.fn(),
  deleteSession: vi.fn(),
  listSessions: vi.fn(),
}));
```

(Keep the existing `import { describe, it, expect, beforeEach } from 'vitest';` line — or merge `vi` into it.)

- [ ] **Step 6: Run the chat store test**

Run: `npx vitest run src/lib/chatStore.test.ts`
Expected: PASS (local behaviour unchanged; the `void api.*` calls are fire-and-forget against the mock).

- [ ] **Step 7: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts src/lib/chatStore.ts src/lib/chatStore.test.ts
git commit -m "feat: stores write through Supabase server actions"
```

### Task 3.6: Hydrate both stores from the server on load

**Files:**
- Create: `src/components/StoreHydrator.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create `src/components/StoreHydrator.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { useCRMStore } from '@/lib/store';
import { useChatStore } from '@/lib/chatStore';
import { listContacts } from '@/lib/contacts.actions';
import { listSessions } from '@/lib/chats.actions';

/** Loads the signed-in user's contacts and chat sessions into the stores once. */
export default function StoreHydrator() {
  const setContacts = useCRMStore((s) => s.setContacts);
  const setSessions = useChatStore((s) => s.setSessions);
  useEffect(() => {
    listContacts().then(setContacts).catch((e) => console.error('Failed to load contacts', e));
    listSessions().then(setSessions).catch((e) => console.error('Failed to load chats', e));
  }, [setContacts, setSessions]);
  return null;
}
```

- [ ] **Step 2: Mount it in `src/app/(app)/layout.tsx`**

```tsx
import Sidebar from "@/components/Sidebar";
import StoreHydrator from "@/components/StoreHydrator";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col h-full">
      <StoreHydrator />
      <Sidebar />
      <main className="flex-1 mt-[4.75rem] px-3 pb-3 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/StoreHydrator.tsx "src/app/(app)/layout.tsx"
git commit -m "feat: hydrate stores from Supabase on load"
```

### Task 3.7: Full verification gate

- [ ] **Step 1: Run the suite + lint + build**

Run: `npm run test && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 2: Manual acceptance** (`npm run dev`)

1. Sign up as a brand-new user → board and chat history are **empty**.
2. Add a contact → it appears; **reload** → it persists.
3. Drag to reorder / move columns → reload preserves order + column.
4. Edit and delete a contact → both persist across reload.
5. Start a chat, send messages, get a prototype reply → reload → the conversation is still in the history.
6. Sign out, sign up as a second user → sees **none** of the first user's contacts or chats.

- [ ] **Step 3: Confirm `.env.local` is untracked**

Run: `git status --porcelain .env.local`
Expected: empty output (gitignored). If it shows, stop and fix `.gitignore`.

- [ ] **Step 4: Final commit (if lint/format fixes were needed)**

```bash
git add -A
git commit -m "chore: final verification fixes"
```

---

## Notes & Risks

- **Modified Next.js (16.2.7):** `middleware.ts` location/matcher and `'use server'` conventions must be verified against `node_modules/next/dist/docs/` (Tasks 2.2, 3.3). If Clerk's `clerkMiddleware` API differs, adapt per the Clerk + Next 16 docs.
- **Clerk peer deps:** if `@clerk/nextjs` rejects React 19 / Next 16, pin to the latest version that supports them and note it; do not force-install.
- **Service-role key:** only ever imported in `src/lib/supabase.ts` (guarded by `import 'server-only'`). Never reference it from a client component.
- **No RLS policy is intentional:** the tables are reachable only via the service-role key inside server actions. If you later move to direct browser→Supabase, add Clerk-JWT RLS policies first.
- **`jsonb` blob storage:** inner contact/chat fields aren't queryable in raw SQL. That's fine — all search/filtering is in-app. If you later need SQL-level queries, promote those fields to columns.
- **Optimistic UX:** contact moves/edits await the server round-trip before the board updates. Acceptable for v1; add true optimistic updates later if drag feels laggy. Chat writes are already fire-and-forget (local update is instant).
- **`crypto.randomUUID()`** requires a secure context (localhost and https both qualify) — fine for dev and prod.
```
