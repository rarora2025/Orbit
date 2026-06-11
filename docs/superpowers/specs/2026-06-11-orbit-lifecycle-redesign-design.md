# Orbit Lifecycle Redesign — Design

**Date:** 2026-06-11
**Status:** Approved
**Builds on / refactors:** the current (uncommitted) Schedule Meeting + lifecycle work
(`scheduleMeeting`, `markMet`, `addNote`, `setFollowUp`, `changeStatusLogged`) which stores
interactions inside the contact's JSONB blob. This redesign moves that data into a real table
and reworks the per-status UX.

## Root problem

Every interaction (notes, follow-ups, meetings) lives inside one JSONB blob on each contact
(`contacts.data.interactions[]`) and is readable only by the detail-panel timeline. So notes
feel invisible, follow-up dates "go nowhere," and there is no structured date to put on a card
or in an agenda. Meeting date/time is currently baked into free text inside `content`.

Every change below sits on top of fixing the storage.

## Status / type mapping

Repo uses capitalized `Status` values; specs use lowercase. Mapping is unchanged:
`send→Send, pending→Pending, response→Response, meeting_scheduled→Meeting Scheduled,
met→Met, ghosted→Ghosted, long_term→Long-term`. Interaction types stay snake_case:
`message_drafted, message_sent, follow_up_scheduled, response_logged, meeting_scheduled,
meeting_completed, note_added, status_changed`.

---

## Phase 1 — Foundation: real `interactions` table

### Schema (new Supabase table)

```
interactions
  id          uuid primary key
  user_id     text not null            -- Clerk user id, scopes every query
  contact_id  uuid not null            -- FK-by-convention to contacts.id
  type        text not null            -- interaction type (snake_case above)
  content     text not null default '' -- human text (note body, response summary, …)
  due_at      timestamptz null         -- structured date for meetings & follow-ups
  created_at  timestamptz not null default now()
```

**`due_at` is the one addition** beyond the originally-listed `interactions` columns. It is the
structured timestamp for `meeting_scheduled` (the meeting time) and `follow_up_scheduled` (when
the nudge is due). It replaces "date baked into `content` text" and is what makes card badges
and the Insights agenda possible. `channel` from the original column list is dropped — nothing
in the app reads it.

Indexes: `(user_id, contact_id)` for per-contact timelines, `(user_id, due_at)` for the agenda.

### Data access

- New module `src/lib/interactions.actions.ts` (server actions) owns all interaction inserts
  and reads. The lifecycle functions currently in `contacts.actions.ts` move here and are
  rewritten to **insert a row** instead of mutating the blob.
- `listContacts()` (in `contacts.actions.ts`) additionally loads the user's interactions and
  attaches `interactions: Interaction[]` (sorted, newest first) to each returned `Contact` in
  memory. Existing components keep reading `contact.interactions` unchanged.
- `Interaction` type (`mockData.ts`) gains `dueAt?: string`; the embedded-array field on
  `Contact` stays (now populated from the join, not the blob).

### Backfill / migration

A one-time backfill reads existing `contacts.data.interactions[]` and inserts each into the new
table (parsing any meeting/follow-up date already present into `due_at` where feasible; older
rows without a parseable date keep `due_at = null`). Written as a standalone script
(`scripts/backfill-interactions.ts`) run once; not part of request flow. After backfill, new
writes go only to the table; the blob array is no longer written.

### Follow-up source of truth

`contacts` keeps `next_follow_up_at` (drives the card's follow-up badge and the existing
`followUpLabel`). When a `follow_up_scheduled` interaction is created, the action sets both the
interaction's `due_at` and the contact's `next_follow_up_at`. Meeting dates come from
`interactions.due_at` where `type = 'meeting_scheduled'`.

---

## Phase 2 — Action model + flow

Per-status buttons (final, from the approved matrix). One **unified orange button** style for
every action (white bg, orange-600 text, orange-200 border, hover orange-50). "Set follow-up"
as a standalone button is **removed**.

| Status | Buttons |
|---|---|
| Send | Draft message · Add note |
| Pending | Log response · Mark ghosted · Add note |
| Response | Draft reply · Schedule meeting · Move to long-term · Add note |
| Meeting Scheduled | Mark as met · Add note |
| Met | Draft message · Move to long-term · Add note |
| Ghosted | Draft message · Move to long-term · Add note |
| Long-term | Draft message · Schedule meeting · Add note |

Behavior changes:
- **Pending is a true waiting state** — no Draft button.
- **Log response auto-opens the Draft-reply modal**: after `logResponse` resolves and the card
  lands in Response, the dashboard opens the draft composer for that contact automatically.
- **Add note** is available on every status (notes are now first-class and surfaced).
- Follow-ups are created only by **Mark sent** (+7-day nudge, existing behavior) and
  **Mark-as-met** (optional user-picked date). No manual "Set follow-up" entry point.
- **Schedule meeting from Long-term** moves the contact to Meeting Scheduled (same action as
  from Response).
- `SetFollowUpModal` is removed; `setFollowUp` action is removed.

`getNextAction` labels are unchanged (already correct per status).

---

## Phase 3 — Timeline (rail style)

Detail-panel timeline becomes a **vertical rail**: a thin line with a colored node per event,
label + meta to the right. One meaningful color + node per action type:

| Type | Label | Color |
|---|---|---|
| message_drafted | Draft message | orange `#ea580c` |
| message_sent | Message sent | blue `#3b82f6` |
| follow_up_scheduled | Follow-up scheduled | amber `#d97706` (shows "Due {date}") |
| response_logged | Response logged | emerald `#10b981` |
| meeting_scheduled | Meeting scheduled | indigo `#6366f1` (shows "{date}, {time}" inline) |
| meeting_completed | Meeting completed | teal `#14b8a6` |
| note_added | Note added | purple `#a855f7` (shows note text) |
| status_changed | Status changed | stone `#78716c` |

**No message bodies in the timeline.** Drafts/sent render as a labeled row only (the message
itself lives in the draft modal). Meetings and follow-ups render their `due_at` inline. **Notes
render their `content`** (reading them is the point). Meta line is `{optional inline detail} ·
{relative time}`.

---

## Phase 4 — Surfacing dates

### Card badge — `src/components/ContactCard.tsx`

One badge per card, chosen by priority: **next upcoming meeting** (`meeting_scheduled.due_at`
in the future) else **next follow-up** (`next_follow_up_at`). Indigo for meetings, amber for
upcoming follow-ups, **red when a follow-up is overdue**. Hidden when neither exists.

### Insights "Upcoming" agenda — `src/app/(app)/page.tsx`

A date-sorted agenda section beside the existing "next moves": meetings + follow-ups grouped by
day (Today / overdue surfaced first), each row with a one-click action (Draft for follow-ups,
Prep for meetings — Prep opens the contact). Built by a **pure helper `buildUpcoming(contacts)`**
over the already-loaded contacts (which now carry their interactions from the Phase 1 join), so
it is unit-testable and needs no extra round-trip.

**No month-grid calendar** — explicitly deferred to a later phase if ever.

---

## Build order

Phase 1 unblocks everything. Phases 2–4 are independent surfaces over the same table and can
land in any order after Phase 1. Each phase keeps the app green (tests + build) before the next.

## Testing

- **Phase 1:** unit tests for the new interaction actions (mocked Supabase, asserting inserts
  are scoped by `user_id` and carry the right `type`/`due_at`); `listContacts` attaches
  interactions. Store tests updated to the new action surface.
- **Phase 2:** store tests for each lifecycle action (status transitions); dashboard
  auto-open-on-log-response covered by a store/flow assertion.
- **Phase 3/4:** pure helpers (`buildUpcoming`, badge selection, rail color map) unit-tested;
  visual structure verified via `next build` + manual walkthrough.
- The lifecycle tests from the prior blob-based work are reworked (not just kept) to target the
  new table-backed actions. After each phase `tsc --noEmit`, `vitest`, and `next build` must all
  pass before moving on.

## Files (by phase)

- **P1:** `interactions` table (Supabase) · `src/lib/interactions.actions.ts` (new) ·
  `src/lib/contacts.actions.ts` (listContacts join; remove blob-mutating lifecycle actions) ·
  `src/lib/mockData.ts` (`Interaction.dueAt`) · `src/lib/store.ts` (point actions at new
  module) · `scripts/backfill-interactions.ts` (new) · tests.
- **P2:** `src/components/ContactDetailPanel.tsx` (button matrix, unified style) ·
  `src/app/(app)/dashboard/page.tsx` (auto-open draft after log response; drop SetFollowUp) ·
  remove `src/components/SetFollowUpModal.tsx` · keep `ScheduleMeetingModal`, `MarkMetModal`,
  `AddNoteModal`.
- **P3:** `src/components/ContactDetailPanel.tsx` (rail timeline) · `src/lib/mockData.ts`
  (color map / labels confirmed).
- **P4:** `src/components/ContactCard.tsx` (badge) · `src/app/(app)/page.tsx` (Upcoming
  agenda) · `src/lib/` upcoming/badge helpers + tests.

## Out of scope

No month-grid calendar; no Google Calendar; no goals/onboarding/graph/CSV import; no per-card
analytics. `channel` on interactions is dropped. Chat is untouched.
