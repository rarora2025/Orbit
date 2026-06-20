# Design: Insights polish, consistent overdue labels, dashboard search + resize, stronger context

Date: 2026-06-17

A round of polish on top of the merged context/archive/mobile work. Four
independent areas; one spec.

## 1. Insights — reorder + swap Next Moves / Upcoming treatments

File: `src/app/(app)/page.tsx` (+ `src/lib/upcoming.ts` data is unchanged).

- **Order:** Goals → Your Next Moves → Upcoming (Next Moves now sits above
  Upcoming).
- **Your Next Moves → a vertical list.** Replace the horizontal rail of tall
  `MoveCard`s with compact full-width rows. Each row shows: the kind pill
  (Follow-up / Reply / Outreach, reuse `KIND_DOT` / `KIND_PILL` / `KIND_LABEL`),
  the person's name, a one-line reason (`move.detail` / `move.title`), and inline
  actions **Draft**, **Done** (✓), **Dismiss** (✗). No message-body preview.
  Rationale: the Done/Dismiss ("prove/deny") buttons were getting cut off in the
  tall cards; inline row actions are always visible.
  - Keep the existing `markDone` / `dismiss` / `draftFor` handlers and the
    dismissed-set behavior; only the presentation changes.
  - The list grows naturally; the page already scrolls vertically.
- **Upcoming → horizontal cards.** Replace the small vertical list with a
  horizontal rail of cards (mirroring the Goals rail): tag pill
  (Meeting / Follow-up / Send), name, `when`, and the Prep/Draft action. Apply
  the `.scroll-affordance` class so it's clearly scrollable.
- Empty states preserved for both sections.

## 2. Consistent overdue labels

File: `src/lib/upcoming.ts`.

- `contactDateBadge`: when overdue, label becomes `Overdue (<short date>)` for
  BOTH send and follow-up — drop the "Overdue to send" / "Follow-up overdue"
  split. Non-overdue labels unchanged.
- `buildUpcoming`: the `when` for an overdue follow-up/send becomes
  `Overdue (<short date>)` to match (was just `Overdue`).
- Short date uses the existing `dateShort` helper.
- Update `src/lib/upcoming.test.ts` expectations for the new label text.

## 3. Dashboard — search bar + resizable panel

File: `src/app/(app)/dashboard/page.tsx` (+ a small `ContactSearch` component;
reuse `src/lib/contactSearch.ts`).

- **Search bar** pinned at the top of the Dashboard (in the header row alongside
  the archived toggle / ViewToggle). As the user types, show a dropdown of
  matches from `searchContacts` over ALL contacts (active + archived). Selecting
  a result calls `selectContact(id)` to open the detail panel, clears the query,
  and (if archived) still opens fine. Keyboard: Esc clears; click-away closes.
- **Resizable divider** between the board column and the detail panel. When the
  panel is open on desktop (md+), render a thin drag handle on the panel's left
  edge. Dragging adjusts the panel width via component state (px), clamped to a
  sensible min/max. Width is NOT persisted — it resets to the default on reload.
  On mobile the panel stays its current full-width/overlay behavior (no handle).

## 4. Stronger context capture in chat

File: `src/lib/chat/prompt.ts`.

- Broaden what counts as context so casual, implicit, or emotional statements are
  caught — e.g. "Elio, Madi and I hate him", "she's my old roommate", "really
  sharp, met at YC". The moment the user reveals ANY such fact or sentiment about
  a person, proactively propose `set_context` (merging into existing context) or,
  if it's ambiguous which person/what to store, ask one quick "want me to save
  that to <name>'s context?" — rather than letting it pass.
- This refines existing guidance; the `set_context` tool and merge behavior are
  unchanged.

## Testing & verification

- Update `upcoming.test.ts` for the new overdue label text.
- Add a small test for the search filter (reuses `contactSearch`, which is
  already tested — assert the dashboard's selection wiring only if a pure helper
  is extracted).
- Run vitest, `tsc --noEmit`, and `next build` — all must pass.
- Live-check the stronger context prompt against the real model with a casual
  statement (e.g. the "Elio … hate him" example) to confirm it proposes
  set_context or asks.

## Out of scope

No data-model changes. No global (nav) search — search is Dashboard-only. No
width persistence. LinkedIn enrichment remains parked.
