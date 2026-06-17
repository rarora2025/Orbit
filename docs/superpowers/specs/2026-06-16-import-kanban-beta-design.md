# Design: AI import, kanban scroll/sort, and beta badges

Date: 2026-06-16

Four independent improvements to Orbit, batched from one round of user feedback.

## 1. AI-powered contact import

**Problem:** Onboarding's paste/CSV import (`StepContacts` in `src/app/onboarding/page.tsx`)
uses a brittle heuristic, `parseContactLines`, that splits on `,` / `;` / tab and
guesses fields. Anything that isn't already in `Name, Company, email, phone` order
(email signatures, "Name — Company", numbered lists, multi-column CSVs with headers)
parses wrong or not at all.

**Solution:** Run every paste/upload through OpenAI to normalize it.

- New server module `src/lib/import.actions.ts` (`'use server'`) exporting
  `parseContactsWithAI(text: string): Promise<ImportRow[]>`.
  - Uses the existing OpenAI setup (`OPEN_AI_KEY`, model `gpt-4o-mini`) — same
    pattern as `src/lib/ai.actions.ts`.
  - Requests a JSON response (`response_format: { type: 'json_object' }`) with a
    prompt that extracts a clean array of `{ name, company?, email?, phone? }`,
    one object per real person, dropping headers/blank/junk lines and handling
    arbitrary input formats.
  - Returns rows shaped exactly like the existing `ImportRow` type so downstream
    code (`addPeople`, `personFrom`) is unchanged.
- **Always runs** on paste and on file upload (per user choice — most robust).
- **Fallback:** if `OPEN_AI_KEY` is missing or the API call throws/returns
  unparseable JSON, fall back to the existing `parseContactLines` heuristic so
  onboarding never breaks offline. `parseContactLines` stays where it is (or moves
  next to the action) and is reused as the fallback.
- **UI:** `StepContacts` `doPaste` and `onFile` become async. While parsing, show
  a loading state ("Reading your list…") and disable the action button. On
  success, feed rows to `addPeople` as today. On total failure (no rows), leave
  the paste text in place so the user can retry.

**Data flow:** pasted text → `parseContactsWithAI` (server) → `ImportRow[]` →
`addPeople` → `Person[]` state → existing onboarding submit.

## 2. Kanban — see the end of every section

**Problem:** In `src/app/(app)/dashboard/page.tsx` the board area is locked to one
screen (`overflow-y-hidden`), and grouped columns (e.g. Response + Ghosted) split
the height 50/50 via `flex-1`, each `KanbanColumn` getting a cramped inner
`overflow-y-auto`. With many contacts a section becomes a tiny scroll box whose end
you can't see.

**Solution:** Keep the section layout (header pills, stacked grouping,
drag-and-drop) but let sections grow to their content and scroll the **whole board**
vertically as one unit.

- Dashboard board container: allow vertical scroll (replace `overflow-y-hidden`
  with vertical scrolling; keep horizontal scroll for narrow widths). Columns may
  exceed the viewport height.
- Column groups: drop the forced equal-height (`h-full` / `flex-1` on the stacked
  sections) so each section sizes to its content and aligns to the top.
- `KanbanColumn` (`src/components/KanbanColumn.tsx`): the cards container grows to
  natural height instead of `flex-1 min-h-0 overflow-y-auto`. Drag-over / drop /
  indicator behavior is preserved.
- Sections are **not** capped — one long section makes the board tall and the user
  scrolls down to its end. This is the explicit goal ("see the end of them").

## 3. Sort within each section

Fixed sensible default, no UI control.

- Within each status column, order by **soonest due first**: contacts with a
  scheduled meeting / follow-up come first (earliest date, overdue at top), then
  contacts with nothing scheduled fall back to existing board `position`.
- Reuses `nextContactAt` from `src/lib/upcoming.ts` (already used for the table
  view's ordering in `dashboard/page.tsx`). Apply the same comparator per column
  when building `byStatus`, scoped to each status's contacts.

## 4. "Beta" badges (visual only, no feature gating)

- **Chat** (`src/app/(app)/chat/page.tsx`):
  - A small "Beta" pill next to the empty-state hero title ("Jump in, {firstName}").
  - A subtle persistent "Beta" tag in the chat history sidebar header (near the
    "New chat" button) so it shows even mid-conversation.
- **Insights** (`src/app/(app)/page.tsx`): a "Beta" pill next to the "Goals"
  heading (alongside the existing count).
- Styling: small rounded pill matching existing pill language (e.g. amber/stone
  tint, `text-[10px]/[11px]`, uppercase or sentence "Beta"). No gating, flags, or
  behavior changes.

## Out of scope

- No changes to the chat/AI backend, no feature-flag system, no kanban sort UI
  control, no caps/virtualization on long sections.
