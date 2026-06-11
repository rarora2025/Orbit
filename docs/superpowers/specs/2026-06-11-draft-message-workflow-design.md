# Draft Message Workflow — Design

**Date:** 2026-06-11
**Status:** Approved
**Approach:** A (adapt to existing JSONB architecture) + A1 (keep OpenAI generation with deterministic fallback)

## Goal

Implement the Orbit outreach workflow end-to-end:

> Draft Message → Save Draft / Mark Sent → Timeline updates → Move to Pending → Schedule Follow-up.

The feature is driven from the contact detail panel's "Draft message" button (and the
Insights "next moves" cards, which share the same modal).

## Context: spec vs. reality

The originating spec assumed a normalized, flat schema (snake_case columns on `contacts`,
a separate `interactions` table, lowercase statuses, no OpenAI). The `davao` codebase is
different, and we are adapting the feature onto what exists rather than rewriting the
storage layer:

- `contacts` is stored as a JSONB blob: columns `id, user_id, position, data, updated_at`.
  Everything lives in `data` (`contacts.actions.ts`).
- Interactions are an **embedded array** on the contact (`Interaction[]`, `mockData.ts`).
  There is currently **no way to persist a new interaction** — they only exist as seed data.
- Statuses are capitalized: `'Send' | 'Pending' | 'Response' | 'Ghosted' | 'Meeting Scheduled' | 'Met' | 'Long-term'`.
- OpenAI drafting shipped in the most recent commit (`ai.actions.ts` + `useDraftComposer`).
- The detail panel already has a "Draft message" button and a Timeline section.

Because contacts are a schemaless JSONB blob, **no DB migration is required**. The spec's
requirement #1 (add columns / create an `interactions` table) is N/A under this approach —
interactions remain embedded and become persistable for the first time via new actions.

## Status mapping

The spec's lowercase statuses map 1:1 to the existing capitalized `Status` values:

| Spec | This repo |
|------|-----------|
| `send` | `Send` |
| `pending` | `Pending` |
| `response` | `Response` |
| `meeting_scheduled` | `Meeting Scheduled` |
| `met` | `Met` |
| `ghosted` | `Ghosted` |
| `long_term` | `Long-term` |

## Components

### 1. Data model — `src/lib/mockData.ts`

- Extend `Interaction.type` union to add `'message_drafted' | 'message_sent' | 'follow_up_scheduled'`
  (keep existing `sent | received | note | meeting`).
- Add optional `channel?: string` to `Interaction`.
- Add optional `nextFollowUpAt?: string` to `Contact`. The existing `lastContacted` field is
  the spec's `last_contacted_at`.
- Add `getNextAction(contact): string` deriving the next action from `contact.status`:
  - `Send` → "Send first message to {name}"
  - `Pending` → "Follow up if no response"
  - `Response` → "Schedule meeting or reply"
  - `Meeting Scheduled` → "Prepare for meeting"
  - `Met` → "Add notes and decide follow-up"
  - `Ghosted` → "Decide whether to revive"
  - `Long-term` → "Keep warm over time"
- Add a unified `INTERACTION_LABEL` record covering both new and legacy types:
  - `message_drafted` = "Drafted outreach message"
  - `message_sent` = "Marked message as sent"
  - `follow_up_scheduled` = "Follow-up scheduled"
  - `response_logged` = "Response logged"
  - `meeting_scheduled` = "Meeting scheduled"
  - `note_added` = "Note added"
  - legacy `sent/received/note/meeting` retained.

### 2. Deterministic generator — `src/lib/draftMessage.ts` (new)

```ts
type Tone = 'Short' | 'Casual' | 'Professional';
type Channel = 'Email' | 'LinkedIn' | 'Text';
function generateDraftMessage(contact: Contact, tone: Tone, channel: Channel): string;
```

Pure, deterministic templates built from `name`, `company`, `role`, `relationshipGoal`
(the spec's `goal`), and `notes`. Tone shapes length/voice; channel shapes greeting and
sign-off (Email fuller, Text terse, LinkedIn medium). No placeholder brackets. Unit-tested
with vitest (`draftMessage.test.ts`). `getNextAction` also unit-tested.

### 3. Persistence — `src/lib/contacts.actions.ts` + `src/lib/store.ts`

New server actions (read current contact → append → write, returning the updated `Contact`):

- `addDraftInteraction(contactId, { channel, content })` — appends a `message_drafted`
  interaction. **Does not** change `status`.
- `markMessageSent(contactId, { channel, content })` — in one write: appends `message_sent`
  and `follow_up_scheduled` interactions, sets `status = 'Pending'`, `lastContacted = now`,
  `nextFollowUpAt = now + 7 days`.

Each appends with a generated interaction id and ISO `date`/timestamp. Store gains
`saveDraft(contactId, input)` and `markSent(contactId, input)` that call these actions and
`upsertLocal` the returned contact. Because the board, column counts, Insights moves, and
the open detail panel all read the same zustand store, they update reactively from one
source of truth.

### 4. Composer — `src/components/useDraftComposer.ts` + `src/components/DraftModal.tsx` + `src/lib/ai.actions.ts`

- `useDraftComposer` owns `contact + tone + channel`. On open and on tone/channel change it
  sets the deterministic `generateDraftMessage` output instantly, then swaps in the OpenAI
  result (A1) when it lands; the deterministic text is kept if no key / the call fails.
  Request-id guarding (already present) prevents stale swaps.
- `generateDraft` (`ai.actions.ts`) gains optional `tone` / `channel` params woven into the
  prompt so OpenAI honors the selectors.
- `DraftModal` gains a **channel selector** (Email / LinkedIn / Text), a **tone selector**
  (Short / Casual / Professional), the editable textarea, and buttons **Copy / Save Draft /
  Mark Sent / Cancel**.
  - Title: "Draft outreach to {contact.name}".
  - **Save Draft** → `store.saveDraft`, shows an inline "Saved" state, stays open.
  - **Mark Sent** → `store.markSent`, then closes the modal (detail panel stays open,
    selection unchanged).
  - Changing tone/channel regenerates the draft text (replacing edits — that is the point of
    the selectors).

### 5. Detail panel — `src/components/ContactDetailPanel.tsx`

- "Next action" section uses `getNextAction(c)` instead of stored `c.nextAction`.
- Follow-up display: when `status === 'Pending'` and `nextFollowUpAt` exists —
  today → "Follow up today", past → "Follow-up overdue", else → "Follow up on {date}".
- Timeline uses the unified `INTERACTION_LABEL`; already reverse-chronological; shows
  timestamp + content preview; empty → "No interactions logged yet." (already present).
- Draft button opens the composer with the full contact.

### 6. Wiring — `dashboard/page.tsx`, `page.tsx` (Insights), `ContactTable.tsx`

- Both entry points (detail panel and Insights move cards) route through the upgraded modal
  and pass `contactId`, so Save Draft / Mark Sent work in both without breaking Insights.
- `ContactTable.tsx` switched to `getNextAction` so next action has a single source of truth.

## Styling

Unchanged: white background, orange accent, rounded cards, subtle borders, minimal UI. The
existing modal styling is extended in place — no visual redesign.

## Reactivity flow (Mark Sent)

1. User clicks Mark Sent in the modal.
2. `store.markSent` → `markMessageSent` action writes the JSONB blob and returns the contact.
3. `upsertLocal` replaces the contact in the store and re-sorts by position.
4. Dashboard `byStatus` recomputes → card moves from the Send column to Pending; column
   counts update.
5. Detail panel (reads `contacts.find(selectedContactId)`) re-renders → new timeline entries,
   new next action, follow-up line.
6. Modal closes; selection is preserved so the panel stays open.

## Testing (manual)

1. Click a contact (status Send) → detail panel opens.
2. Click "Draft message" → modal titled "Draft outreach to {name}" with channel + tone
   selectors and a generated draft.
3. Click Save Draft → "Saved" state; the panel timeline shows "Drafted outreach message";
   status unchanged.
4. Click Mark Sent → modal closes; the card moves to Pending; column counts update; panel
   stays open showing "Marked message as sent" + "Follow-up scheduled"; next action becomes
   "Follow up if no response"; a "Follow up on {date}" (≈ +7 days) line appears.

## Files changed

- `src/lib/mockData.ts` — interaction types, `nextFollowUpAt`, `getNextAction`, labels
- `src/lib/draftMessage.ts` (new) + `src/lib/draftMessage.test.ts` (new)
- `src/lib/contacts.actions.ts` — `addDraftInteraction`, `markMessageSent`
- `src/lib/store.ts` — `saveDraft`, `markSent`
- `src/lib/ai.actions.ts` — optional tone/channel in `generateDraft`
- `src/components/useDraftComposer.ts` — own contact/tone/channel
- `src/components/DraftModal.tsx` — selectors + Save Draft / Mark Sent / Copy / Cancel
- `src/components/ContactDetailPanel.tsx` — derived next action, follow-up line, labels
- `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/page.tsx`, `src/components/ContactTable.tsx` — wiring

## Out of scope

- No `goals`, `next_moves`, graph, or `metadata` tables; no stored `next_action`.
- No schema migration / normalized `interactions` table (interactions stay embedded).
- No visual redesign.
