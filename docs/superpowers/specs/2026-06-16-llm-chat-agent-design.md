# Orbit Chat — Real LLM agent

**Status:** approved-by-delegation (user asked to auto-accept and build)
**Date:** 2026-06-16

Turn the chat from a local heuristic responder into a real, streaming LLM agent that
reasons over the user's whole network, remembers who they are across chats, and can
**propose actions** (create people, create goals, update relationships, draft outreach)
that the user confirms inline — no forms.

## Decisions (from brainstorming)

- **Capabilities:** answer/analyze, add people, create/manage goals, update relationships,
  draft outreach, probe & coach. **Not** proactive sourcing of net-new people.
- **Action UX:** *always confirm.* The model never mutates data directly. It emits a
  **proposal** rendered as an inline card; the action runs only when the user taps Confirm
  (Edit / Cancel also available). Confirm is one click — not a form.
- **Context each turn:** inject a compact snapshot of the *entire* network (every contact:
  name, company, role, status, warmth, tags, goal, last activity; plus all goals) + the
  user's profile memory. No retrieval/RAG at this scale.
- **Memory:** a persistent **profile memory** ("about you") in a new `user_context` row,
  updated in the background after each turn and injected into every future chat.
- **Model:** OpenAI (existing infra, `OPEN_AI_KEY`). `gpt-4o` for the agent; keep
  `gpt-4o-mini` for the cheap background memory-update pass and existing draft generation.
- **Remove** the add-person / add-goal buttons & modals from the chat — creation happens
  conversationally through proposals.

## Architecture

```
client (chat page)
  │  POST /api/chat  { sessionId, messages }
  ▼
route handler  src/app/api/chat/route.ts   (streams)
  │  buildSystemPrompt(network snapshot + profile memory + persona + tool defs)
  │  OpenAI chat.completions.create({ model: gpt-4o, tools, stream:true })
  │  → stream text deltas to client as they arrive
  │  → accumulate tool_call deltas; at end emit `proposals`
  ▼
client renders streamed text live + proposal cards
  │  user taps Confirm
  ▼
server action  executeChatAction(action)   → existing mutation actions
  │  (addContact / addGoal / markMet / setFollowUp / scheduleMeeting / setStatus /
  │   logResponse / markMessageSent / addGoalMember / generateDraft)
  ▼
client updates stores + shows a green receipt; message persisted to chat_sessions
  │
  └─ after the turn: fire-and-forget updateProfileMemory(conversation)  (gpt-4o-mini)
```

### Streaming protocol (NDJSON over the response body)
Each line is one JSON event:
- `{"type":"text","delta":"…"}` — append to the assistant bubble (typewriter feel comes free).
- `{"type":"proposals","proposals":[ProposedAction,…]}` — render confirm cards.
- `{"type":"error","message":"…"}` — graceful failure (e.g. missing key).
- `{"type":"done"}` — end of turn.

The client reads the stream with `response.body.getReader()` + a line splitter.

### New units (each small, single-purpose, unit-tested where logic is pure)

| Unit | File | Responsibility |
|---|---|---|
| Network snapshot | `src/lib/chat/networkContext.ts` | Pure: contacts+goals → compact text block for the prompt. |
| Tool definitions | `src/lib/chat/tools.ts` | The OpenAI tool schemas + the `ProposedAction` types. Pure. |
| System prompt | `src/lib/chat/prompt.ts` | Pure: persona + snapshot + memory → system message. |
| Action dispatch | `src/lib/chat/executeAction.ts` (`'use server'`) | Maps a confirmed `ProposedAction` → the existing contacts/goals actions; resolves names→ids. |
| Profile memory | `src/lib/chat/memory.actions.ts` (`'use server'`) | Read/merge/persist `user_context`; background update pass. |
| Route handler | `src/app/api/chat/route.ts` | Auth, build messages, stream OpenAI, surface proposals. |
| Chat client | `src/app/(app)/chat/page.tsx` | Stream rendering, proposal cards, confirm → execute, persistence. |

### Tools (model-callable; every one is a *proposal*, confirm-gated)
- `create_contact{ name, company?, role?, email?, linkedinUrl?, warmth? }`
- `create_goal{ title }`
- `add_contact_to_goal{ contactName, goalTitle }`
- `set_status{ contactName, status }`  (Send/Pending/Response/Ghosted/Meeting Scheduled/Met/Long-term)
- `log_meeting{ contactName, notes?, followUpDate? }`  → markMet
- `log_response{ contactName, summary, nextStep? }`
- `mark_sent{ contactName }`
- `set_follow_up{ contactName, date, reason? }`
- `schedule_meeting{ contactName, date, time?, notes? }`
- `draft_message{ contactName, kind?, tone? }`  → on confirm, calls `generateDraft`; the draft
  renders with Save / Mark sent (existing store methods).

Name→id resolution lives in `executeAction`: case-insensitive match on full name / first name /
"name at company". If unresolved for an action that needs an existing contact, the action returns
a typed "not found" the client shows as a gentle error ("I couldn't find Marcus — add him first?").

### Persistence
`StoredMsg` (assistant) gains optional `actions?: ProposedAction[]` where each carries
`{ id, type, args, status: 'pending'|'confirmed'|'cancelled'|'failed', receipt? }`. The active
session is upserted to `chat_sessions` on each change (existing mechanism), so reloading a chat
restores streamed text, proposal cards, and their confirmed/receipt state.

### Profile memory
New table `user_context (user_id text primary key, profile text, updated_at timestamptz)`.
After each user turn, `updateProfileMemory` runs a cheap `gpt-4o-mini` call: "given the prior
profile + this exchange, return an updated concise profile (role, goals, preferences, durable
facts)". Fire-and-forget; never blocks the response. Injected into the system prompt each turn.

## UX / motion (cohesive, dynamic, app-native)
- Remove the composer's add-person/add-goal icons and the empty-state quick-action buttons.
- Streamed text renders token-by-token with a soft caret while generating; a typing indicator
  shows before the first token.
- Proposal cards animate in (scale/fade), show what will change, and have **Confirm / Edit /
  Cancel**. On confirm they morph into a green ✓ receipt; on cancel they collapse.
- Keep the app theme (warm stone/white, Geist). Brand orange reserved for the user bubble, the
  send button, and the Confirm button. Smooth auto-scroll; reduced-motion respected.
- Empty state keeps the (already neutral) starter suggestions; everything else flows through chat.

## Error handling & degradation
- No `OPEN_AI_KEY`: the route streams a single friendly `text` event explaining the agent is
  offline, then `done`. The app never crashes. (Tests cover this branch via the dispatch/snapshot
  units, which are key-independent.)
- OpenAI/network error mid-stream: emit `error` + `done`; the bubble shows a short retry note.
- Confirm executes server-side and is idempotent where the underlying action is; failures surface
  as a `failed` receipt with the reason.

## Testing
Unit tests (vitest, no network):
- `networkContext`: snapshot formatting, empty network, truncation.
- `tools`: schema shape; `ProposedAction` round-trips.
- `executeAction`: name→id resolution (exact, first-name, "at company", ambiguous, not-found) by
  mapping to mocked action fns; status validation.
- `memory`: profile merge/length guard.
- A small NDJSON line-splitter util used by the client gets its own pure test.
LLM calls and the route handler are exercised manually (run the app); they degrade gracefully so
the suite stays green offline.

## Out of scope (fast-follows)
Proactive sourcing of net-new people; per-person AI memory notes; multi-tool transactional
confirm ("do all 3"); calendar/email integration; switching providers to Claude.
