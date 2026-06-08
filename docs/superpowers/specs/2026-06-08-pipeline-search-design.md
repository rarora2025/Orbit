# Pipeline Search — Design

Date: 2026-06-08

## Problem

The **Search** button in the Pipeline header (`src/app/page.tsx`) renders but has no
handler — clicking it does nothing. Wire it up so it actually filters contacts.

## Design

**UI (Option A — inline expanding input):**
Clicking the Search button reveals a text input in the header. Typing live-filters the
contacts shown in the currently active view (Board, Table, or Map). Clearing the input or
closing search restores the full list.

- The Search button toggles search open/closed.
- When open: render a text input (autofocused) in place of / beside the button, with a way
  to close (clear button or close icon). Pressing `Escape` closes and clears.
- When closed: the query is empty and all contacts show.

**Matching:**
Case-insensitive substring match against: `name`, `company`, `role`, and `tags`.
A contact matches if the query appears in any of those fields.

**Scope:**
The filtered list feeds whichever view is active. The header sits above all three views and
narrows the single `contacts` list they read from.

## Implementation notes

- Add `searchOpen` and `query` state to `PipelinePage`.
- Derive `filteredContacts` via `useMemo` from `contacts` + `query`.
- Feed `filteredContacts` into `byStatus` (Board), `ContactTable` (Table). Map view (`TopicMap`)
  reads the store directly today; filtering it is out of scope unless trivial — confirm during
  implementation.
- Empty query ⇒ `filteredContacts === contacts` (no filtering).

## Out of scope

- Command-palette / ⌘K overlay.
- Searching `inquiry` / `notes` / free-text fields.
- Persisting the query across navigation.
