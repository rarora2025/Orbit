# Design: Per-person Context + messages fix (piece A)

Date: 2026-06-17

First of several pieces from a round of feedback. Decomposition agreed with the
user:

- **A (this spec):** a single per-person "context" field + use it to fix generic,
  goal-mentioning messages. Foundation for B.
- **B (later):** chat reads/writes the same context field and probes for it when
  empty.
- **C (parked):** LinkedIn scraping into context — needs a paid third-party API.
- **D (independent):** archive cards on the dashboard.
- **E (independent):** mobile/scroll fixes (Next Moves cutoff, Upcoming scroll).

This spec covers **A only**.

## Problem

Generated outreach messages are generic and they mention the user's goals, which
the user does not want in messages. There is no place to store who a person is,
so drafts have nothing specific to draw on.

## Solution overview

Introduce a single free-text **context** field per contact ("who they are, how
you know them, what matters"), editable in the UI, and rewire message drafting to
use it instead of goals.

## Data model

- In `src/lib/mockData.ts`, rename the contact-level field `notes: string` →
  `context: string`. This is distinct from *meeting* notes captured by
  `MarkMetModal` / `ScheduleMeetingModal` and the `log_meeting` /
  `schedule_meeting` chat tools — those are unrelated and stay as-is.
- Back-compat on read in `rowToContact` (`src/lib/contacts.actions.ts`): the
  contact blob may still carry a legacy `notes` key. Destructure it out and set
  `context: rest.context ?? notes ?? ''`. The legacy key is dropped on the next
  write, mirroring the existing handling of `relationshipGoal` / `inquiry` /
  `priority`.
- Update the spots that initialize the field to `''`:
  - `src/components/ContactModal.tsx` (`notes: ''` → `context: ''`)
  - `src/lib/onboarding.actions.ts` (`notes: ''` → `context: ''`)
  - `src/lib/chat/executeAction.ts` (`notes: ''` → `context: ''`)

## UI

- **Add / Edit person modal (`ContactModal.tsx`):** add a "Context" textarea bound
  to `form.context`, shown for both add and edit. Placeholder: "Who they are, how
  you know them, what matters." Multi-line. No separate create-time popup — this
  one field covers manual entry on create and edit.
- **Contact detail panel (`ContactDetailPanel.tsx`):** add a "Context" `Section`
  that renders `c.context`. Empty state: a muted line inviting the user to add
  context (editing flows through the existing Edit button → modal). Place it near
  the top of the body, above or beside the existing sections.

## Messages / drafting

- **AI draft — `generateDraft` (`src/lib/ai.actions.ts`):**
  - Remove the `contact.goal` line from the prompt entirely.
  - Add the person's `context` to the prompt, e.g. `What I know about ${name}:
    "${context}"`, with an instruction to ground the message specifically in that
    context.
  - When `context` is empty: instruct the model to keep the message short and
    genuine and to NOT invent specifics about the person.
  - Keep using role/company/tags/last interaction as today.
- **Heuristic fallback — `reason()` (`src/lib/draftMessage.ts`):**
  - Drop the `goal` branch. Order becomes: `context` → role+company → company →
    role → "your work".

## Testing

- Update `src/lib/draftMessage.test.ts` for the rename and new precedence
  (context replaces goal/notes as the primary reason).
- Add a `rowToContact` back-compat check (legacy `notes` blob → `context`) if a
  test harness for it is reachable; otherwise assert the mapping via a small unit
  on the destructure logic.
- Run the full suite, `tsc --noEmit`, and `next build` — all must pass.

## Out of scope for A

Chat read/write of context (B), LinkedIn enrichment (C), archive (D), mobile and
scroll fixes (E), and any change to meeting notes.
