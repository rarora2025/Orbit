# Log Response Workflow — Design

**Date:** 2026-06-11
**Status:** Approved
**Builds on:** 2026-06-11-draft-message-workflow-design.md (Approach A — JSONB blob, embedded interactions, capitalized statuses)

## Goal

Add the next pipeline step: **Pending → Log Response → Response column.**

From the contact detail panel, a Pending contact can log a reply. Logging it appends a
`response_logged` interaction, moves the contact to the `Response` column, clears the
follow-up date, and updates the timeline live.

## Already satisfied by the Draft workflow

- Timeline label `response_logged = "Response logged"` already exists in `INTERACTION_LABEL` (`mockData.ts`).
- `getNextAction` already returns "Schedule meeting or reply" for `Response` (`mockData.ts`).

So spec requirements #5 and #6 need no new work.

## Status mapping

Spec lowercase → repo capitalized: `pending → Pending`, `response → Response`.

## Next-step selector (decision: option A)

The modal's optional next-step selector (Reply back / Schedule meeting / Keep warm /
Not interested) is **captured as context**, not used to branch status. Per requirement #4,
status always becomes `Response`. When a next step is chosen it is appended to the logged
interaction's content as `\n\nNext step: {step}`, so it shows in the timeline and is never
lost. It does not change the resulting status.

## Components

### 1. `src/components/LogResponseModal.tsx` (new)

Small centered modal, styled to match `DraftModal` (white / orange / rounded / subtle borders).

- Title: "Log response for {name}".
- Response summary `<textarea>` (accessible label).
- Optional next-step selector — 4 pill options; clicking the selected one again clears it
  (it is optional). `role="radiogroup"` / `aria-checked`.
- Buttons: **Save Response** (disabled while the summary is empty/whitespace or a save is in
  flight) and **Cancel**.
- `onSave(input: { content: string; nextStep?: string }) => Promise<void>`; on success the
  parent closes the modal, on rejection an inline error is shown and the modal stays open.

### 2. `logResponse` server action — `src/lib/contacts.actions.ts`

```ts
export interface ResponseInput { content: string; nextStep?: string }
export async function logResponse(contactId: string, input: ResponseInput): Promise<Contact>
```

Reads the contact (scoped by userId), then in one write:
- appends a `response_logged` interaction: `id` = uuid, `date` = now ISO,
  `channel` = the contact's most recent interaction channel if any (else undefined/null),
  `content` = trimmed summary, with `\n\nNext step: {nextStep}` appended when provided.
- sets `status = 'Response'` and clears `nextFollowUpAt` (set to `undefined`; dropped on
  JSON serialization).
- returns the updated `Contact` via `rowToContact`.

Mirrors the existing `markMessageSent` pattern (requireUserId → listContacts → find → merge →
`supabaseAdmin.update` scoped by `user_id` + `id`).

### 3. Store `logResponse` — `src/lib/store.ts`

`logResponse(contactId, input) => upsertLocal(await api.logResponse(contactId, input))`.
Same reactive fan-out as `markSent`: the board moves the card Pending→Response, column counts
recompute, the open detail panel re-renders, the timeline updates. Selection is untouched so
the panel stays open.

### 4. Detail panel — `src/components/ContactDetailPanel.tsx`

- New prop `onLogResponse: (contact: Contact) => void`.
- In the "Next action" section, when `c.status === 'Pending'`, render a secondary outline
  "Log response" button beside the existing "Draft message" button.

### 5. Dashboard wiring — `src/app/(app)/dashboard/page.tsx`

- New `respondingId` state + derived `respondingContact`.
- Detail panel `onLogResponse={(contact) => setRespondingId(contact.id)}`.
- Render `<LogResponseModal>` when `respondingContact` is set; its `onSave` calls
  `store.logResponse(respondingContact.id, input)` then clears `respondingId`.

Scope: dashboard + detail panel only (Insights has no detail panel).

## Testing

- Unit: store `logResponse` test (mock the action) — asserts the contact moves to `Response`
  and the returned interaction is reflected. Mirrors the existing `markSent`/`saveDraft` tests.
- Manual: mark a contact sent → Pending → Log response → Save → moves to Response, timeline
  shows "Response logged", next action reads "Schedule meeting or reply".

## Files changed

- `src/components/LogResponseModal.tsx` (new)
- `src/lib/contacts.actions.ts` — `logResponse` + `ResponseInput`
- `src/lib/store.ts` — `logResponse`
- `src/lib/store.test.ts` — `logResponse` test
- `src/components/ContactDetailPanel.tsx` — Log response button + prop
- `src/app/(app)/dashboard/page.tsx` — modal state + wiring

## Out of scope

No new tables; no goals/onboarding/graph/CSV import; next step does not branch status.
