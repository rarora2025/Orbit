# Design: Chat context, archive cards, mobile/scroll fixes (pieces B, D, E)

Date: 2026-06-17

Three independent pieces, built on top of piece A (the per-person `context`
field). User auto-approved; build all three, verify, commit, push.

## B — Chat ↔ Context

Goal: the chat can save context about a person, and asks for it when missing.

- **New chat tool `set_context`** in `src/lib/chat/tools.ts`:
  - Args: `{ contactName: string, context: string }`.
  - Added to `CHAT_TOOLS`, the `ProposedAction` union, `parseToolCall`, and
    `describeAction` ("Set context for X" / "Update context for X").
  - It is a confirmable proposal like every other tool (no silent writes).
- **Merge semantics:** the model composes the full updated context itself. To
  enable this it must see the current context, so `buildNetworkSnapshot` /
  `contactLine` in `src/lib/chat/networkContext.ts` include each person's context,
  and append `· no context yet` when empty.
- **Execution:** `src/lib/chat/executeAction.ts` handles `set_context` by calling
  `updateContact(contactId, { context })` (resolve the contact by name with the
  existing `resolveContact` helper, same as other tools).
- **Probing:** `src/lib/chat/prompt.ts` gains a guideline: when about to draft a
  message for, or substantively discuss, a person who has no context yet, ask one
  natural question to learn who they are before drafting — once, not repeatedly.
- UI: the chat already renders proposed actions via `describeAction` and runs
  them via `executeChatAction`, so no chat-page changes beyond the new variant.

## D — Archive cards

Goal: hide people from the dashboard board + table without deleting them.

- **Data:** add `archived?: boolean` to `Contact` (`src/lib/mockData.ts`).
  Persists in the contact blob; absent/false = active. No back-compat needed.
- **Scope:** archived contacts are hidden **only** from the dashboard board and
  table. They still appear in Insights, chat, and search.
- **Store** (`src/lib/store.ts`): `archiveContact(id)` and `unarchiveContact(id)`,
  each delegating to the existing `updateContact(id, { archived })` path so it
  persists like any other field edit.
- **Dashboard** (`src/app/(app)/dashboard/page.tsx`):
  - Filter active vs archived once: `active = contacts.filter(c => !c.archived)`,
    `archived = contacts.filter(c => c.archived)`. Board (`byStatus`) and table
    (`sortedContacts`) use `active`.
  - A **"Show archived" toggle** in the header (a slick pill showing the count).
    Off by default. When on, the main area shows a clean archived list (cards in a
    responsive grid) with an **Unarchive** action on each; the board/table is
    hidden while viewing archived.
- **Card** (`src/components/ContactCard.tsx`): add an optional `onArchive`
  handler rendered as an Archive icon button in the existing hover actions row
  (next to edit/delete). In the archived list the card shows Unarchive instead
  (via an `archived` prop that swaps the icon/handler).
- Delete stays as-is; archive is an additional, non-destructive action.

## E — Mobile / scroll fixes

Goal: Next Moves no longer cut off on mobile; scroll areas read as scrollable.

- **Next Moves cutoff** (`src/app/(app)/page.tsx`): on small screens the Insights
  card scrolls vertically (`overflow-y-auto md:overflow-hidden`) and the Next
  Moves rail gets a real min-height (`min-h-[460px] md:min-h-0`) so the full
  cards — including the action buttons — always fit. Desktop fill-the-height
  behavior is unchanged.
- **Clearer scrollability:** the global scrollbar is very faint. Add a
  `.scroll-affordance` utility in `src/app/globals.css` that gives a more visible
  scrollbar (slightly wider, tinted thumb) and a subtle trailing edge fade via
  `mask-image`, applied to the Upcoming list and the horizontal rails (Goals,
  Next Moves) so it's obvious there's more to scroll.

## Testing & verification

- Add/extend unit tests where there is pure logic: `set_context` parsing in
  `tools.ts` (parse + describe), and the archived filter helper if extracted.
- Update any Contact test fixtures only if the new optional field forces it (it
  shouldn't, being optional).
- Run the full vitest suite, `tsc --noEmit`, and `next build` — all must pass.
- Live-check the chat `set_context` round-trip prompt against the real key
  (extraction/merge sanity), as done for earlier pieces.

## Out of scope

LinkedIn enrichment (piece C, parked). No changes to meeting notes, goals
behavior, or the message-drafting logic shipped in piece A.
