# Clerk Auth + Supabase Persistence + Slimmed Contact Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk auth and per-user Supabase persistence to the CRM, while stripping the contact model down to `name, company, status, score (AI), temperature (AI), tags (AI)` and deleting the pages built on the removed fields.

**Architecture:** Browser runs a Zustand store hydrated from the server. All Supabase access goes through Next.js **server actions** that read the Clerk `userId` via `auth()` and scope every query `where user_id = userId` using the service-role key (server-only). RLS is enabled with no permissive policy as a backstop.

**Tech Stack:** Next.js 16.2.7 (App Router, **modified — read `node_modules/next/dist/docs/` before writing middleware/server actions**), React 19, Zustand 5, `@clerk/nextjs`, `@supabase/supabase-js`, Vitest 2, Tailwind 4.

**Source of truth:** `docs/superpowers/specs/2026-06-08-clerk-supabase-auth-design.md`.

**Phases (each ends with working, committed software):**
1. New core modules (slim types, AI-signals stub, ordering math, avatar helper) + delete dead pages.
2. Refactor components + store to the slim model (in-memory, board starts empty).
3. Clerk auth (provider, middleware, sign-in/up, route group, sidebar user button).
4. Supabase persistence (schema, server actions scoped by `userId`, async store, hydrator).

---

## File Structure

**Create:**
- `src/lib/contact.ts` — slim `Status`, `Temperature`, `Contact` types + `columnConfig`.
- `src/lib/contactSignals.ts` — `generateContactSignals()` AI stub.
- `src/lib/contactSignals.test.ts`
- `src/lib/position.ts` — board ordering math.
- `src/lib/position.test.ts`
- `src/lib/supabase.ts` — server-only admin client (Phase 4).
- `src/lib/contacts.actions.ts` — server actions (Phase 4).
- `src/lib/contacts.actions.test.ts` — userId-scoping tests (Phase 4).
- `src/components/StoreHydrator.tsx` — seeds store from server (Phase 4).
- `src/app/(app)/layout.tsx` — authed layout w/ Sidebar + hydrator (Phase 3/4).
- `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx` (Phase 3).
- `middleware.ts` (repo root) — Clerk middleware (Phase 3).

**Modify:**
- `src/lib/store.ts`, `src/lib/contactSearch.ts`, `src/lib/cardVisuals.ts`
- `src/components/ContactCard.tsx`, `ContactTable.tsx`, `ContactModal.tsx`, `KanbanColumn.tsx`, `StatusPill.tsx`, `TopicMap.tsx`, `Sidebar.tsx`
- `src/app/page.tsx` (moves to `src/app/(app)/page.tsx` in Phase 3), `src/app/map/page.tsx` (→ `src/app/(app)/map/page.tsx`)
- `src/app/layout.tsx` — `<ClerkProvider>` (Phase 3)
- existing tests: `src/lib/store.test.ts`, `src/lib/contactSearch.test.ts`

**Delete:**
- `src/lib/mockData.ts`
- `src/app/outreach/`, `src/app/next-moves/`, `src/app/insights/`
- `src/components/PriorityBadge.tsx`

---

# Phase 1 — New core modules + delete dead pages

App keeps working throughout (components still import `mockData`; the new modules are additive). Only the three dead pages and their links are removed.

### Task 1.1: Slim contact types module

**Files:**
- Create: `src/lib/contact.ts`

- [ ] **Step 1: Write the file**

```ts
// Core contact model. Deliberately minimal: only the fields that matter, with
// score / temperature / tags produced by the AI signals generator (see
// contactSignals.ts) rather than entered by hand.
export type Status = 'Send' | 'Pending' | 'Response' | 'Ghosted';
export type Temperature = 'Low' | 'Medium' | 'High';

export interface Contact {
  id: string;
  name: string;
  company: string;
  status: Status;
  score: number;            // AI-generated fit score, 0–100
  temperature: Temperature; // AI-generated
  tags: string[];           // AI-generated, up to 2
  position: number;         // ordering within a board column
}

// Per-column accent + subtitle used by the Kanban board.
export const columnConfig: Record<Status, { dot: string; subtitle: string }> = {
  'Send':     { dot: 'bg-blue-500',    subtitle: 'Not reached out yet' },
  'Pending':  { dot: 'bg-yellow-400',  subtitle: 'Awaiting reply' },
  'Response': { dot: 'bg-emerald-500', subtitle: 'They replied' },
  'Ghosted':  { dot: 'bg-red-500',     subtitle: 'Gone cold' },
};
```

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit`
Expected: PASS (no errors introduced by this file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/contact.ts
git commit -m "feat: add slim Contact type module"
```

### Task 1.2: AI signals generator (stub)

**Files:**
- Create: `src/lib/contactSignals.ts`
- Test: `src/lib/contactSignals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { generateContactSignals } from './contactSignals';

describe('generateContactSignals', () => {
  it('returns neutral placeholder signals (stub for the future LLM)', () => {
    const s = generateContactSignals('Ada Lovelace', 'Analytical Engines');
    expect(s.score).toBe(50);
    expect(s.temperature).toBe('Medium');
    expect(s.tags).toEqual([]);
  });

  it('produces values in the contract ranges', () => {
    const s = generateContactSignals('', '');
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.tags.length).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/contactSignals.test.ts`
Expected: FAIL — `generateContactSignals` not found.

- [ ] **Step 3: Write the implementation**

```ts
import type { Temperature } from './contact';

export interface ContactSignals {
  score: number;            // 0–100 AI fit score
  temperature: Temperature; // AI temperature
  tags: string[];           // up to 2 AI tags
}

/**
 * Produce the AI-derived signals for a contact.
 *
 * TODO(ai): replace this deterministic placeholder with a real LLM call. It is
 * intentionally a stub so the rest of the app — persistence and
 * recalculation-on-action — is fully wired and ready for the model swap.
 */
export function generateContactSignals(name: string, company: string): ContactSignals {
  void name;
  void company;
  return { score: 50, temperature: 'Medium', tags: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/contactSignals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contactSignals.ts src/lib/contactSignals.test.ts
git commit -m "feat: add AI contact-signals generator (stub)"
```

### Task 1.3: Board ordering math

**Files:**
- Create: `src/lib/position.ts`
- Test: `src/lib/position.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { appendPosition, positionBefore, sortByPosition } from './position';
import type { Contact } from './contact';

function c(id: string, status: Contact['status'], position: number): Contact {
  return { id, name: id, company: '', status, score: 0, temperature: 'Medium', tags: [], position };
}

describe('position helpers', () => {
  it('appendPosition starts a fresh column at STEP', () => {
    expect(appendPosition([], 'Send')).toBe(1000);
  });

  it('appendPosition goes after the last card in the column', () => {
    const list = [c('a', 'Send', 1000), c('b', 'Send', 2000), c('x', 'Pending', 5000)];
    expect(appendPosition(list, 'Send')).toBe(3000);
  });

  it('positionBefore lands between neighbours', () => {
    const list = [c('a', 'Send', 1000), c('b', 'Send', 2000)];
    expect(positionBefore(list, 'Send', 'b', 'moving')).toBe(1500);
  });

  it('positionBefore at the head of a column halves the first position', () => {
    const list = [c('a', 'Send', 1000)];
    expect(positionBefore(list, 'Send', 'a', 'moving')).toBe(500);
  });

  it('positionBefore with null target appends to the column end', () => {
    const list = [c('a', 'Send', 1000)];
    expect(positionBefore(list, 'Send', null, 'moving')).toBe(2000);
  });

  it('sortByPosition orders ascending', () => {
    const sorted = sortByPosition([c('b', 'Send', 2000), c('a', 'Send', 1000)]);
    expect(sorted.map(x => x.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/position.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import type { Contact, Status } from './contact';

const STEP = 1000;

/** Position for a new card appended to the end of its column. */
export function appendPosition(contacts: Contact[], status: Status): number {
  const inColumn = contacts.filter(c => c.status === status);
  if (inColumn.length === 0) return STEP;
  return Math.max(...inColumn.map(c => c.position)) + STEP;
}

/**
 * Position that places `movingId` immediately before `beforeId` within
 * `status`. When `beforeId` is null or not found, the card is appended to the
 * end of the column.
 */
export function positionBefore(
  contacts: Contact[],
  status: Status,
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
  return (prev + next) / 2;
}

/** Ascending order by `position` (column grouping is the caller's job). */
export function sortByPosition(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => a.position - b.position);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/position.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/position.ts src/lib/position.test.ts
git commit -m "feat: add board ordering (position) helpers"
```

### Task 1.4: Deterministic avatar color helper

`avatarColor` is no longer stored, so derive it from the name at render time.

**Files:**
- Modify: `src/lib/cardVisuals.ts`
- Test: `src/lib/cardVisuals.test.ts`

- [ ] **Step 1: Add the failing test** (append to existing `cardVisuals.test.ts`)

```ts
import { avatarClasses } from './cardVisuals';

describe('avatarClasses', () => {
  it('is deterministic for the same name', () => {
    expect(avatarClasses('Shayne Coplan')).toBe(avatarClasses('Shayne Coplan'));
  });
  it('returns a tailwind bg+text class pair', () => {
    expect(avatarClasses('Ada')).toMatch(/^bg-.+ text-.+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cardVisuals.test.ts`
Expected: FAIL — `avatarClasses` not exported.

- [ ] **Step 3: Append the implementation to `src/lib/cardVisuals.ts`**

```ts
const AVATAR_PALETTE = [
  'bg-teal-200 text-teal-900', 'bg-orange-200 text-orange-900', 'bg-blue-200 text-blue-900',
  'bg-emerald-200 text-emerald-900', 'bg-purple-200 text-purple-900', 'bg-rose-200 text-rose-900',
  'bg-amber-200 text-amber-900', 'bg-cyan-200 text-cyan-900', 'bg-violet-200 text-violet-900',
];

/** Deterministic avatar background+text classes, indexed by a hash of the name. */
export function avatarClasses(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/cardVisuals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cardVisuals.ts src/lib/cardVisuals.test.ts
git commit -m "feat: derive avatar color from name"
```

### Task 1.5: Delete the three dead pages and their nav links

**Files:**
- Delete: `src/app/outreach/`, `src/app/next-moves/`, `src/app/insights/`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Delete the page directories**

```bash
git rm -r src/app/outreach src/app/next-moves src/app/insights
```

- [ ] **Step 2: Trim the nav list in `src/components/Sidebar.tsx`**

Replace the `navItems` array (and the now-unused icon imports) so only Pipeline and Topic Map remain:

```tsx
import { LayoutGrid, Map } from 'lucide-react';
import OrbitLogo from './OrbitLogo';

const navItems = [
  { href: '/',    icon: LayoutGrid, label: 'Pipeline'  },
  { href: '/map', icon: Map,        label: 'Topic Map' },
];
```

(Leave the rest of the file unchanged for now; the user block is replaced in Phase 3.)

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: PASS — no remaining references to the deleted routes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Outreach, Next Moves, Insights pages and links"
```

---

# Phase 2 — Refactor components + store to the slim model

Switch everything off `mockData` and onto `contact.ts`. The store becomes an empty in-memory store (no mock seeding, no `localStorage`). At the end of this phase the app builds, the board renders empty, and adding a contact works in-memory (lost on reload — persistence arrives in Phase 4).

### Task 2.1: Slim, in-memory Zustand store

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/store.test.ts`

- [ ] **Step 1: Replace `src/lib/store.test.ts`** with tests for the new in-memory reducers

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCRMStore } from './store';
import type { Contact } from './contact';

function c(id: string, status: Contact['status'], position: number): Contact {
  return { id, name: id, company: '', status, score: 0, temperature: 'Medium', tags: [], position };
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

  it('applyAdded appends and re-sorts', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000)]);
    useCRMStore.getState().applyAdded(c('b', 'Send', 500));
    expect(useCRMStore.getState().contacts.map(x => x.id)).toEqual(['b', 'a']);
  });

  it('applyRemoved drops the contact and clears selection', () => {
    useCRMStore.getState().setContacts([c('a', 'Send', 1000)]);
    useCRMStore.setState({ selectedContactId: 'a' });
    useCRMStore.getState().applyRemoved('a');
    expect(useCRMStore.getState().contacts).toEqual([]);
    expect(useCRMStore.getState().selectedContactId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/store.test.ts`
Expected: FAIL — `loaded` / `setContacts` / `applyAdded` not defined.

- [ ] **Step 3: Replace `src/lib/store.ts`** with the in-memory store

```ts
'use client';

import { create } from 'zustand';
import type { Contact } from './contact';
import { sortByPosition } from './position';

interface CRMStore {
  contacts: Contact[];
  loaded: boolean;
  selectedContactId: string | null;
  setContacts: (contacts: Contact[]) => void;
  applyAdded: (contact: Contact) => void;
  applyUpdated: (contact: Contact) => void;
  applyRemoved: (id: string) => void;
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>()((set) => ({
  contacts: [],
  loaded: false,
  selectedContactId: null,
  setContacts: (contacts) => set({ contacts: sortByPosition(contacts), loaded: true }),
  applyAdded: (contact) =>
    set((s) => ({ contacts: sortByPosition([...s.contacts, contact]) })),
  applyUpdated: (contact) =>
    set((s) => ({ contacts: sortByPosition(s.contacts.map((c) => (c.id === contact.id ? contact : c))) })),
  applyRemoved: (id) =>
    set((s) => ({
      contacts: s.contacts.filter((c) => c.id !== id),
      selectedContactId: s.selectedContactId === id ? null : s.selectedContactId,
    })),
  selectContact: (id) => set({ selectedContactId: id }),
}));
```

> Note: the mutating actions (`addContact`/`moveContact`/etc. that call the server) are added in Phase 4. In Phase 2 the board uses `applyAdded`/`applyUpdated`/`applyRemoved` locally so the UI is exercisable.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "refactor: slim in-memory Zustand store"
```

### Task 2.2: Slim the search to the new shape

**Files:**
- Modify: `src/lib/contactSearch.ts`
- Modify: `src/lib/contactSearch.test.ts`

- [ ] **Step 1: Update `src/lib/contactSearch.ts`**

Change the import to `./contact` and drop `role` from the searchable text:

```ts
import type { Contact } from './contact';

// Match against the identifying attributes you'd look someone up by.
function searchableText(contact: Contact): string {
  return [contact.name, contact.company, ...contact.tags].join(' ').toLowerCase();
}
```

(Keep the `filterContacts` function body and its doc unchanged except removing the word "role".)

- [ ] **Step 2: Update `src/lib/contactSearch.test.ts`** — replace the `makeContact` factory and any `role`/removed fields with the slim shape

```ts
import type { Contact } from './contact';

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: '0', name: '', company: '', status: 'Send',
    score: 0, temperature: 'Medium', tags: [], position: 0,
    ...overrides,
  };
}
```

Delete the `it('matches on tags', ...)`-adjacent assertions that relied on `role`; keep name/company/tag matching cases. Remove the `role:` keys from the sample contacts.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/contactSearch.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/contactSearch.ts src/lib/contactSearch.test.ts
git commit -m "refactor: search over slim contact shape"
```

### Task 2.3: Point StatusPill, KanbanColumn, TopicMap at `contact.ts`

**Files:**
- Modify: `src/components/StatusPill.tsx`, `src/components/KanbanColumn.tsx`, `src/components/TopicMap.tsx`

- [ ] **Step 1: StatusPill** — change `import { Status } from '@/lib/mockData';` → `import type { Status } from '@/lib/contact';`

- [ ] **Step 2: KanbanColumn** — change `import { Contact, Status, columnConfig } from '@/lib/mockData';` → `import { type Contact, type Status, columnConfig } from '@/lib/contact';` (no other changes; `columnConfig` is now keyed by `Status`).

- [ ] **Step 3: TopicMap** — replace the `mockData` import. `topicClusters` was demo data; inline it locally and drop `contact.role`:

Replace `import { topicClusters } from '@/lib/mockData';` with a local constant near the top of the file:

```tsx
// Fixed topic taxonomy for the map. (Demo data — a future task can derive
// clusters from real tags.)
const topicClusters = [
  { id: 'prediction-markets', name: 'Prediction Markets', contacts: 11, strength: 'strong', color: 'bg-emerald-600' },
  { id: 'vc-funds',           name: 'VC / Funds',          contacts: 6,  strength: 'medium', color: 'bg-blue-600' },
  { id: 'academic',           name: 'Academic',            contacts: 3,  strength: 'weak',   color: 'bg-amber-600' },
];
```

Then change the contact subtitle line (currently `{contact.role} · {companyDisplayName(contact.company)}`) to company only:

```tsx
<p className="text-[12px] text-stone-500 truncate">{companyDisplayName(contact.company)}</p>
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: PASS (TopicMap/StatusPill/KanbanColumn no longer reference `mockData`).

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusPill.tsx src/components/KanbanColumn.tsx src/components/TopicMap.tsx
git commit -m "refactor: move StatusPill/KanbanColumn/TopicMap to slim model"
```

### Task 2.4: Rewrite ContactCard for the slim model

**Files:**
- Modify: `src/components/ContactCard.tsx`

- [ ] **Step 1: Replace the file** with the slim version (uses stored `score`, `temperature`; company-only subtitle; derived avatar color; drops the `warmth`-based local score):

```tsx
'use client';

import { useState } from 'react';
import type { Contact } from '@/lib/contact';
import { avatarClasses } from '@/lib/cardVisuals';
import StatusPill from './StatusPill';
import CompanyLogo from './CompanyLogo';

interface Props {
  contact: Contact;
  onClick: () => void;
  isSelected?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const TEMP_LEVEL: Record<Contact['temperature'], number> = { Low: 1, Medium: 2, High: 3 };
const MAX_TAGS = 2;

export default function ContactCard({ contact, onClick, isSelected, draggable, onDragStart, onDragEnd }: Props) {
  const [dragging, setDragging] = useState(false);
  const temp = TEMP_LEVEL[contact.temperature] ?? 1;
  const initial = (contact.company || contact.name || '?').charAt(0).toUpperCase();
  const visibleTags = contact.tags.slice(0, MAX_TAGS);

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => { setDragging(true); onDragStart?.(e); }}
      onDragEnd={(e) => { setDragging(false); onDragEnd?.(e); }}
      className={`contact-card rounded-xl p-3 border bg-white transition-all duration-200 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${
        isSelected
          ? 'border-orange-400 ring-1 ring-orange-200 shadow-md'
          : 'border-stone-200/60 hover:border-stone-300 hover:shadow-md hover:-translate-y-0.5'
      } ${
        dragging ? 'opacity-40 scale-[0.98] shadow-lg rotate-[0.5deg]' : ''
      }`}
    >
      {/* Header: brand logo · name/company · fit score */}
      <div className="flex items-start gap-2.5">
        <CompanyLogo
          company={contact.company}
          fallbackInitial={initial}
          fallbackColor={contact.company ? 'bg-stone-100 text-stone-500' : avatarClasses(contact.name)}
          className="w-11 h-11 rounded-lg border border-stone-200 flex-shrink-0 p-1"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-stone-900 leading-tight truncate">{contact.name}</p>
          {contact.company && (
            <p className="text-[13px] text-stone-500 leading-tight truncate mt-0.5">{contact.company}</p>
          )}
        </div>
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full border-[1.5px] border-orange-400 flex items-center justify-center"
          title={`AI fit score ${contact.score}`}
        >
          <span className="text-[13px] font-bold text-orange-500 leading-none">{contact.score}</span>
        </div>
      </div>

      {/* Footer: status + temperature, then AI tags */}
      <div className="mt-2.5 pt-2.5 border-t border-stone-100">
        <div className="flex items-center gap-1.5">
          <StatusPill status={contact.status} size="sm" />
          <span
            title={`Temperature: ${contact.temperature}`}
            aria-label={`Temperature ${contact.temperature}`}
            className="ml-auto pl-1 font-bold text-[15px] leading-none tracking-[0.15em] select-none"
          >
            <span className="text-orange-500">{'*'.repeat(temp)}</span>
            <span className="text-stone-300">{'*'.repeat(3 - temp)}</span>
          </span>
        </div>
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {visibleTags.map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-full bg-stone-100 text-stone-600 text-[11px] font-medium px-2 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContactCard.tsx
git commit -m "refactor: slim ContactCard (stored score/temperature)"
```

### Task 2.5: Rewrite ContactTable for the slim columns

**Files:**
- Modify: `src/components/ContactTable.tsx`
- Delete: `src/components/PriorityBadge.tsx`

- [ ] **Step 1: Replace `src/components/ContactTable.tsx`** with slim columns (Person, Company, Status, Score, Temperature, Tags):

```tsx
'use client';

import type { Contact } from '@/lib/contact';
import StatusPill from './StatusPill';
import TagChip from './TagChip';
import CompanyLogo from './CompanyLogo';
import { companyDisplayName } from '@/lib/companyLogo';

interface Props {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const HEADERS = ['Person', 'Company', 'Status', 'Score', 'Temp', 'Tags'];
const TEMP_LEVEL: Record<Contact['temperature'], number> = { Low: 1, Medium: 2, High: 3 };

export default function ContactTable({ contacts, selectedId, onSelect }: Props) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-3">
          <span className="text-2xl">🤝</span>
        </div>
        <p className="text-stone-600 font-medium text-sm">No contacts found</p>
        <p className="text-stone-400 text-xs mt-1">Add your first contact or adjust your filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-200/70">
              {HEADERS.map(h => (
                <th key={h} className="text-left text-[12px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-2.5 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const isSelected = selectedId === contact.id;
              const companyLabel = companyDisplayName(contact.company);
              const companyInitial = (companyLabel || contact.name).charAt(0).toUpperCase();
              const temp = TEMP_LEVEL[contact.temperature] ?? 1;

              return (
                <tr
                  key={contact.id}
                  onClick={() => onSelect(contact.id)}
                  className={`group cursor-pointer border-b border-stone-100 last:border-0 transition-colors ${
                    isSelected ? 'bg-orange-50/70' : 'hover:bg-stone-50/70'
                  }`}
                >
                  {/* Person */}
                  <td className="px-4 py-3 relative">
                    {isSelected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-orange-400 rounded-r" />}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                        {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <p className="text-[15px] font-semibold text-stone-800 leading-tight truncate">{contact.name}</p>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {contact.company && (
                        <div className="w-7 h-7 rounded-md border border-stone-200 bg-white flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <CompanyLogo company={contact.company} fallbackInitial={companyInitial} fallbackColor="text-stone-400" className="w-full h-full p-1" />
                        </div>
                      )}
                      <p className="text-[15px] font-medium text-stone-700 truncate">{companyLabel || '—'}</p>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3"><StatusPill status={contact.status} size="sm" /></td>

                  {/* Score */}
                  <td className="px-4 py-3">
                    <div className="w-[30px] h-[30px] rounded-full border-[1.5px] border-orange-400 flex items-center justify-center">
                      <span className="text-[13px] font-bold text-orange-500 leading-none">{contact.score}</span>
                    </div>
                  </td>

                  {/* Temperature */}
                  <td className="px-4 py-3">
                    <span className="font-bold text-[15px] tracking-[0.15em] select-none" title={`Temperature: ${contact.temperature}`}>
                      <span className="text-orange-500">{'*'.repeat(temp)}</span>
                      <span className="text-stone-300">{'*'.repeat(3 - temp)}</span>
                    </span>
                  </td>

                  {/* Tags */}
                  <td className="px-4 py-3 max-w-[240px]">
                    {contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.slice(0, 2).map(tag => <TagChip key={tag} tag={tag} />)}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete the now-unused PriorityBadge**

```bash
git rm src/components/PriorityBadge.tsx
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: slim ContactTable, drop PriorityBadge"
```

### Task 2.6: Slim ContactModal to name/company/status

**Files:**
- Modify: `src/components/ContactModal.tsx`

- [ ] **Step 1: Replace the file.** The modal now collects only name/company/status; score/temperature/tags are AI-generated server-side, so they are no longer in the form. `onAdd` emits an input object; `onSave` emits the changed core fields.

```tsx
'use client';

import { useState } from 'react';
import type { Contact, Status } from '@/lib/contact';
import { X } from 'lucide-react';
import CompanyLogo from './CompanyLogo';

export interface ContactInput {
  name: string;
  company: string;
  status: Status;
}

interface Props {
  onClose: () => void;
  /** Present → edit mode (form pre-filled, Save updates this contact). */
  contact?: Contact;
  /** Called in add mode with the new contact's core fields. */
  onAdd?: (input: ContactInput) => void;
  /** Called in edit mode with the id and the changed core fields. */
  onSave?: (id: string, updates: Partial<ContactInput>) => void;
}

const statuses: Status[] = ['Send', 'Pending', 'Response', 'Ghosted'];

export default function ContactModal({ onClose, contact, onAdd, onSave }: Props) {
  const isEdit = !!contact;
  const [form, setForm] = useState<ContactInput>({
    name: contact?.name ?? '',
    company: contact?.company ?? '',
    status: contact?.status ?? 'Send',
  });

  function handleChange(key: keyof ContactInput, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload: ContactInput = { name: form.name.trim(), company: form.company.trim(), status: form.status };
    if (isEdit && contact) onSave?.(contact.id, payload);
    else onAdd?.(payload);
  }

  const inputClass = "w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors";
  const labelClass = "block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
          <div>
            <h2 className="font-bold text-stone-900 text-lg">{isEdit ? 'Edit Person' : 'Add Person'}</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {isEdit ? 'Update the details and save' : 'Just the essentials — the AI fills in the rest'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className={labelClass}>Name *</label>
            <input className={inputClass} placeholder="Shayne Coplan" required value={form.name} onChange={e => handleChange('name', e.target.value)} autoFocus />
          </div>

          <div>
            <label className={labelClass}>Company</label>
            <div className="flex items-center gap-2">
              <CompanyLogo
                company={form.company}
                fallbackInitial={(form.company || '?').charAt(0).toUpperCase()}
                fallbackColor="bg-stone-100 text-stone-400"
                className="w-9 h-9 rounded-lg border border-stone-200 flex-shrink-0 p-1"
              />
              <input className={inputClass} placeholder="Polymarket" value={form.company} onChange={e => handleChange('company', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={form.status} onChange={e => handleChange('status', e.target.value as Status)}>
              {statuses.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="px-5 py-2 bg-stone-900 text-white text-sm font-semibold rounded-lg hover:bg-stone-800 transition active:scale-95 shadow-sm">
            {isEdit ? 'Save Changes' : 'Add Person'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContactModal.tsx
git commit -m "refactor: slim ContactModal to name/company/status"
```

### Task 2.7: Wire the board page to the in-memory store

**Files:**
- Modify: `src/app/page.tsx`

In Phase 2 the page calls the local `apply*` reducers directly (Phase 4 swaps these for server-backed async actions). Update the imports and handlers.

- [ ] **Step 1: Update imports** at the top of `src/app/page.tsx`

```tsx
import { type Status, columnConfig } from '@/lib/contact';
import { generateContactSignals } from '@/lib/contactSignals';
import { appendPosition, positionBefore } from '@/lib/position';
import type { ContactInput } from '@/components/ContactModal';
```

(Remove the old `import { Status } from '@/lib/mockData';`. `columnConfig` import is only needed if the page references it — keep only what is used.)

- [ ] **Step 2: Replace the store destructure and handlers.** Swap the `useCRMStore` line and the add/edit/move wiring to use the new reducers, building the full `Contact` locally for now:

```tsx
const { contacts, selectedContactId, selectContact, applyAdded, applyUpdated, applyRemoved } = useCRMStore();

function handleAddSubmit(input: ContactInput) {
  const signals = generateContactSignals(input.name, input.company);
  applyAdded({
    id: crypto.randomUUID(),
    name: input.name,
    company: input.company,
    status: input.status,
    position: appendPosition(contacts, input.status),
    ...signals,
  });
  setShowAdd(false);
}

function handleEditSave(id: string, updates: Partial<ContactInput>) {
  const existing = contacts.find(c => c.id === id);
  if (!existing) return;
  // Re-run the AI signals when a status change happens (recalculate-on-action).
  const signals = updates.status && updates.status !== existing.status
    ? generateContactSignals(updates.name ?? existing.name, updates.company ?? existing.company)
    : {};
  applyUpdated({ ...existing, ...updates, ...signals });
  selectContact(null);
}

function handleMoveContact(contactId: string, status: Status, beforeId: string | null) {
  const existing = contacts.find(c => c.id === contactId);
  if (!existing) return;
  const position = positionBefore(contacts, status, beforeId, contactId);
  const signals = status !== existing.status
    ? generateContactSignals(existing.name, existing.company)
    : {};
  applyUpdated({ ...existing, status, position, ...signals });
}
```

- [ ] **Step 3: Update the modal usages** in the JSX:

```tsx
{showAdd && (
  <ContactModal onAdd={handleAddSubmit} onClose={() => setShowAdd(false)} />
)}
{!showAdd && selectedContact && (
  <ContactModal contact={selectedContact} onSave={handleEditSave} onClose={() => selectContact(null)} />
)}
```

(The add button already sets `addStatus`; fold it into `handleAddSubmit` by having the Add modal pass `status` from its own select — `addStatus` can seed the modal later, but for now the modal's status select is the source of truth. Remove the now-unused `addStatus`/`setAddStatus` if they cause lint errors, or keep seeding by passing it as the modal's initial — simplest: delete `addStatus` state and the `{ ...c, status: addStatus }` logic.)

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run build`
Expected: PASS. Manually: `npm run dev`, open `/`, board renders empty, "Add Person" creates an in-memory card, drag reorders it.

- [ ] **Step 5: Delete `src/lib/mockData.ts`** (now unreferenced)

```bash
git rm src/lib/mockData.ts
npm run build
```
Expected: build PASS — confirms nothing imports `mockData` anymore.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: board page on slim in-memory store; remove mockData"
```

---

# Phase 3 — Clerk authentication

App now requires sign-in. Board is still the in-memory store (persistence is Phase 4).

### Task 3.1: Create the Clerk application (user-performed)

- [ ] **Step 1:** Go to https://dashboard.clerk.com → **Create application**. Name it (e.g. "Orbit CRM"). Enable **Email** and any social providers you want. Click **Create**.
- [ ] **Step 2:** On the **API Keys** page, copy the **Publishable key** and **Secret key**.
- [ ] **Step 3:** Create `.env.local` in the repo root (already gitignored via `.env*`) with:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### Task 3.2: Install Clerk and read the Next.js middleware docs

**Files:** `package.json`

- [ ] **Step 1: Read the modified-Next.js docs** for middleware (AGENTS.md mandate):

Run: `ls node_modules/next/dist/docs/01-app && grep -rl "middleware" node_modules/next/dist/docs/01-app | head`
Read the middleware guide it points to. Confirm the `middleware.ts` location (repo root vs `src/`) and the `config.matcher` export shape this Next version expects.

- [ ] **Step 2: Install Clerk**

Run: `npm install @clerk/nextjs`
Expected: installs without peer-dependency errors. If it warns about React 19 / Next 16 peers, note it and proceed only if install succeeds.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @clerk/nextjs"
```

### Task 3.3: ClerkProvider in the root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1:** Wrap the app in `<ClerkProvider>` and remove the Sidebar/main shell from the root layout (the shell moves to the authed route group in Task 3.5). The root layout becomes:

```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pursuit CRM",
  description: "AI-powered relationship manager for ambitious founders",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable} h-full antialiased`}>
        <body className="h-full bg-[#faf9f5] font-sans">{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2:** Do not build yet (routes move in 3.5). Commit after 3.5.

### Task 3.4: Middleware + sign-in/up pages

**Files:**
- Create: `middleware.ts` (repo root)
- Create: `src/app/sign-in/[[...sign-in]]/page.tsx`
- Create: `src/app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Create `middleware.ts`** (verify the matcher/shape against the docs read in 3.2):

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

### Task 3.5: Move authed pages into a route group with the Sidebar shell

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Move: `src/app/page.tsx` → `src/app/(app)/page.tsx`; `src/app/map/` → `src/app/(app)/map/`

- [ ] **Step 1: Move the pages** (route group `(app)` does not change the URLs):

```bash
mkdir -p "src/app/(app)"
git mv src/app/page.tsx "src/app/(app)/page.tsx"
git mv src/app/map "src/app/(app)/map"
```

- [ ] **Step 2: Create `src/app/(app)/layout.tsx`** with the Sidebar/main shell (moved out of root layout):

```tsx
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 ml-12 flex flex-col min-h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify build + auth flow**

Run: `npm run build && npm run dev`
Expected: visiting `/` while signed out redirects to `/sign-in`; signing up lands back on the board. `/map` works when signed in.

- [ ] **Step 4: Commit (3.3–3.5 together)**

```bash
git add -A
git commit -m "feat: Clerk auth — provider, middleware, sign-in/up, authed route group"
```

### Task 3.6: Clerk user button in the sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1:** Replace the hardcoded user block (the `{/* User */}` div with "Rahul Arora") with Clerk's user button + live name:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Map } from 'lucide-react';
import { UserButton, useUser } from '@clerk/nextjs';
import OrbitLogo from './OrbitLogo';
```

And the user section:

```tsx
{/* User */}
<div className="flex items-center gap-3 px-2.5 py-4 border-t border-stone-200/60 flex-shrink-0">
  <UserButton appearance={{ elements: { rootBox: 'w-7 h-7 flex-shrink-0', avatarBox: 'w-7 h-7' } }} />
  <UserName />
</div>
```

Add a small client subcomponent at the bottom of the file:

```tsx
function UserName() {
  const { user } = useUser();
  if (!user) return null;
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 min-w-0">
      <p className="text-[14px] font-medium text-stone-700 whitespace-nowrap truncate">{user.fullName ?? 'Account'}</p>
      <p className="text-[12px] text-stone-400 whitespace-nowrap truncate">{user.primaryEmailAddress?.emailAddress ?? ''}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build`
Expected: PASS; the sidebar shows the Clerk avatar and the signed-in user's name; clicking it offers Sign out.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: Clerk user button in sidebar"
```

---

# Phase 4 — Supabase persistence

Replace the in-memory mutations with server actions scoped by the Clerk `userId`. Fresh users see an empty board; data persists across reloads and is strictly per-user.

### Task 4.1: Create the Supabase project + schema (user-performed)

- [ ] **Step 1:** Go to https://supabase.com/dashboard → **New project**. Pick a name + DB password + region. Wait for provisioning.
- [ ] **Step 2:** Open **SQL Editor** → **New query** → paste and **Run**:

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
-- No permissive policy: only the service-role key (our server actions) may read/write.
```

- [ ] **Step 3:** Go to **Project Settings → API**. Copy the **Project URL** and the **service_role** secret. Add to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # service_role — server only, never expose
```

### Task 4.2: Install supabase-js + server-only admin client

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
 * Server-only Supabase client using the service-role key. NEVER import this
 * into a client component — it bypasses RLS. Every query MUST be scoped by the
 * caller's Clerk userId (see contacts.actions.ts).
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

### Task 4.3: Server actions, scoped by Clerk userId (TDD on scoping)

**Files:**
- Create: `src/lib/contacts.actions.ts`
- Test: `src/lib/contacts.actions.test.ts`

- [ ] **Step 1: Read the server-actions docs** (AGENTS.md mandate):

Run: `grep -rl "use server\|Server Actions" node_modules/next/dist/docs/01-app | head`
Read it; confirm `'use server'` module conventions for this Next version.

- [ ] **Step 2: Write the failing test** — assert every read/write is scoped by `userId` and that a missing user is rejected. The Supabase client and Clerk `auth` are mocked.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const eq = vi.fn();
const order = vi.fn();
const select = vi.fn();
const insert = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  // from('contacts').select('*').eq('user_id', uid).order(...) -> { data, error }
  order.mockResolvedValue({ data: [], error: null });
  eq.mockReturnValue({ order, eq });
  select.mockReturnValue({ eq });
  from.mockReturnValue({ select, insert });
});

describe('listContacts', () => {
  it('throws when there is no signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { listContacts } = await import('./contacts.actions');
    await expect(listContacts()).rejects.toThrow(/auth/i);
  });

  it('scopes the query to the Clerk userId', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { listContacts } = await import('./contacts.actions');
    await listContacts();
    expect(from).toHaveBeenCalledWith('contacts');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
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
import type { Contact, Status, Temperature } from './contact';
import { generateContactSignals } from './contactSignals';
import { appendPosition, positionBefore } from './position';

interface Row {
  id: string;
  name: string;
  company: string;
  status: Status;
  score: number;
  temperature: Temperature;
  tags: string[];
  position: number;
}

function rowToContact(r: Row): Contact {
  return {
    id: r.id, name: r.name, company: r.company, status: r.status,
    score: r.score, temperature: r.temperature, tags: r.tags, position: r.position,
  };
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
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(rowToContact);
}

export async function addContact(input: { name: string; company: string; status: Status }): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const signals = generateContactSignals(input.name, input.company);
  const position = appendPosition(existing, input.status);
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({ user_id: userId, name: input.name, company: input.company, status: input.status, ...signals, position })
    .select('*')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

export async function updateContact(
  id: string,
  updates: { name?: string; company?: string; status?: Status },
): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find(c => c.id === id);
  if (!current) throw new Error('Contact not found');

  const name = updates.name ?? current.name;
  const company = updates.company ?? current.company;
  const status = updates.status ?? current.status;
  // Recalculate AI signals when the status changes (recalculate-on-action).
  const signals = updates.status && updates.status !== current.status
    ? generateContactSignals(name, company)
    : {};

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ name, company, status, ...signals, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

export async function moveContact(id: string, toStatus: Status, beforeId: string | null): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find(c => c.id === id);
  if (!current) throw new Error('Contact not found');

  const position = positionBefore(existing, toStatus, beforeId, id);
  const signals = toStatus !== current.status
    ? generateContactSignals(current.name, current.company)
    : {};

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ status: toStatus, position, ...signals, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
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

### Task 4.4: Connect the store to server actions

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1:** Add async, server-backed mutating actions that delegate to the `apply*` reducers. Extend the store interface and creator:

```ts
'use client';

import { create } from 'zustand';
import type { Contact, Status } from './contact';
import { sortByPosition } from './position';
import * as api from './contacts.actions';

interface CRMStore {
  contacts: Contact[];
  loaded: boolean;
  selectedContactId: string | null;
  setContacts: (contacts: Contact[]) => void;
  applyAdded: (contact: Contact) => void;
  applyUpdated: (contact: Contact) => void;
  applyRemoved: (id: string) => void;
  addContact: (input: { name: string; company: string; status: Status }) => Promise<void>;
  updateContact: (id: string, updates: { name?: string; company?: string; status?: Status }) => Promise<void>;
  moveContact: (id: string, toStatus: Status, beforeId: string | null) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  selectContact: (id: string | null) => void;
}

export const useCRMStore = create<CRMStore>()((set, get) => ({
  contacts: [],
  loaded: false,
  selectedContactId: null,
  setContacts: (contacts) => set({ contacts: sortByPosition(contacts), loaded: true }),
  applyAdded: (contact) => set((s) => ({ contacts: sortByPosition([...s.contacts, contact]) })),
  applyUpdated: (contact) => set((s) => ({ contacts: sortByPosition(s.contacts.map((c) => (c.id === contact.id ? contact : c))) })),
  applyRemoved: (id) => set((s) => ({
    contacts: s.contacts.filter((c) => c.id !== id),
    selectedContactId: s.selectedContactId === id ? null : s.selectedContactId,
  })),
  addContact: async (input) => { get().applyAdded(await api.addContact(input)); },
  updateContact: async (id, updates) => { get().applyUpdated(await api.updateContact(id, updates)); },
  moveContact: async (id, toStatus, beforeId) => { get().applyUpdated(await api.moveContact(id, toStatus, beforeId)); },
  deleteContact: async (id) => { await api.deleteContact(id); get().applyRemoved(id); },
  selectContact: (id) => set({ selectedContactId: id }),
}));
```

- [ ] **Step 2: Verify store tests still pass** (they only touch the `apply*`/`setContacts` reducers):

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat: store mutations call server actions"
```

### Task 4.5: Hydrate the store from the server on load

**Files:**
- Create: `src/components/StoreHydrator.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create `src/components/StoreHydrator.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { useCRMStore } from '@/lib/store';
import { listContacts } from '@/lib/contacts.actions';

/** Loads the signed-in user's contacts into the store once on mount. */
export default function StoreHydrator() {
  const setContacts = useCRMStore((s) => s.setContacts);
  useEffect(() => {
    listContacts().then(setContacts).catch((e) => console.error('Failed to load contacts', e));
  }, [setContacts]);
  return null;
}
```

- [ ] **Step 2: Mount it in the authed layout** `src/app/(app)/layout.tsx`

```tsx
import Sidebar from "@/components/Sidebar";
import StoreHydrator from "@/components/StoreHydrator";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full">
      <StoreHydrator />
      <Sidebar />
      <main className="flex-1 ml-12 flex flex-col min-h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/StoreHydrator.tsx "src/app/(app)/layout.tsx"
git commit -m "feat: hydrate store from Supabase on load"
```

### Task 4.6: Switch the board page to the async server-backed actions

**Files:**
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1:** Replace the Phase-2 local handlers with calls to the async store actions. The store now owns signal generation/positioning (done server-side), so the page just forwards inputs:

```tsx
const { contacts, selectedContactId, selectContact, addContact, updateContact, moveContact } = useCRMStore();

function handleAddSubmit(input: ContactInput) {
  void addContact(input);
  setShowAdd(false);
}

function handleEditSave(id: string, updates: Partial<ContactInput>) {
  void updateContact(id, updates);
  selectContact(null);
}

function handleMoveContact(contactId: string, status: Status, beforeId: string | null) {
  void moveContact(contactId, status, beforeId);
}
```

Remove the now-unused imports from Phase 2 (`generateContactSignals`, `appendPosition`, `positionBefore`, `crypto.randomUUID` usage). Keep `import type { Status } from '@/lib/contact'` and `import type { ContactInput } from '@/components/ContactModal'`.

- [ ] **Step 2: Verify end-to-end**

Run: `npm run build && npm run dev`
Manual acceptance:
1. Sign up as a brand-new user → board is **empty**.
2. Add a contact → it appears; **reload** → it persists.
3. Drag to reorder / move columns → reload preserves order/column.
4. Edit + delete persist across reload.
5. Sign out, sign up as a second user → sees **none** of the first user's contacts.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat: board uses server-backed persistence"
```

### Task 4.7: Full verification gate

- [ ] **Step 1:** Run the whole suite + lint + build

Run: `npm run test && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 2:** Confirm `.env.local` is untracked

Run: `git status --porcelain .env.local`
Expected: empty output (gitignored). If it shows up, stop and fix `.gitignore`.

- [ ] **Step 3: Final commit (if any lint/format fixes were needed)**

```bash
git add -A
git commit -m "chore: final verification fixes"
```

---

## Notes & Risks

- **Modified Next.js (16.2.7):** `middleware.ts` location/matcher and `'use server'` conventions must be verified against `node_modules/next/dist/docs/` (Tasks 3.2, 4.3). If Clerk's `clerkMiddleware` API differs, adapt per the Clerk + Next 16 docs.
- **Clerk peer deps:** if `@clerk/nextjs` rejects React 19 / Next 16, pin to the latest version that supports them and note it; do not force-install.
- **Service-role key:** only ever imported in `src/lib/supabase.ts` (guarded by `import 'server-only'`). Never reference it from a client component.
- **No RLS policy is intentional:** the table is reachable only via the service-role key inside server actions. If you later move to direct browser→Supabase (Approach 2/3 in the spec), add Clerk-JWT RLS policies first.
- **Optimistic UX:** moves/edits await the server round-trip before updating the board. Fine for v1; add optimistic updates later if it feels laggy.
