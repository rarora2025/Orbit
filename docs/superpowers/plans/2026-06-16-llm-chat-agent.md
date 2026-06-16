# LLM Chat Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chat's heuristic responder with a streaming OpenAI agent that reasons over the whole network, remembers the user across chats, and proposes confirm-gated actions (create people/goals, update relationships, draft outreach).

**Architecture:** A streaming Route Handler (`/api/chat`) builds a system prompt from a compact whole-network snapshot + profile memory, calls `gpt-4o` with tool definitions, streams text as NDJSON, and surfaces tool calls as proposals. Confirmed proposals run through a `executeChatAction` server action that delegates to existing contacts/goals actions. Profile memory lives in a new `user_context` table, updated in the background.

**Tech Stack:** Next 16 route handlers, OpenAI Node SDK (already a dep), Clerk auth, Supabase, Zustand, Tailwind v4, vitest.

---

## File structure

- `src/lib/chat/networkContext.ts` — pure: contacts+goals → compact prompt text.
- `src/lib/chat/tools.ts` — pure: `ProposedAction` types + OpenAI tool schemas + helpers.
- `src/lib/chat/prompt.ts` — pure: persona + snapshot + memory → system message string.
- `src/lib/chat/ndjson.ts` — pure: streaming line splitter.
- `src/lib/chat/memory.actions.ts` — `'use server'`: read/write/update `user_context` (graceful).
- `src/lib/chat/executeAction.ts` — `'use server'`: confirmed `ProposedAction` → existing actions.
- `src/app/api/chat/route.ts` — streaming POST handler.
- `src/lib/chatStore.ts` — extend `StoredMsg` assistant with `actions?`.
- `src/app/(app)/chat/page.tsx` — streaming client, proposal cards, confirm→execute; remove buttons.
- Tests: `*.test.ts` beside each pure unit + `executeAction.test.ts`.

---

### Task 1: Network snapshot

**Files:** Create `src/lib/chat/networkContext.ts`, `src/lib/chat/networkContext.test.ts`.

- [ ] Test: empty contacts/goals → `'No contacts yet.'` / `'No goals yet.'`; a contact line includes name, company, status, warmth, tags, goal; goals list shows membership counts.
- [ ] Implement `buildNetworkSnapshot(contacts: Contact[], goals: Goal[]): string` — a compact, line-per-contact block (`- Sarah Chen — Research Lead at Anthropic · Pending · High · tags: AI, Research · goal: Fundraising · last activity 2026-06-02`) and a goals block. Cap at ~150 contacts (note truncation).
- [ ] Run `npx vitest run src/lib/chat/networkContext.test.ts`; commit.

### Task 2: Tools + types

**Files:** Create `src/lib/chat/tools.ts`, `src/lib/chat/tools.test.ts`.

- [ ] Define `ProposedAction` discriminated union (one variant per tool in the spec) with an `id` and `args`.
- [ ] Define `CHAT_TOOLS` (OpenAI `tools` array) — function schema per action. Define `parseToolCall(name, argsJson): ProposedAction | null`.
- [ ] Test: every tool name maps to a parser; bad JSON → null; a `create_contact` round-trips name/company.
- [ ] Run vitest; commit.

### Task 3: System prompt

**Files:** Create `src/lib/chat/prompt.ts`, `src/lib/chat/prompt.test.ts`.

- [ ] `buildSystemPrompt({ snapshot, memory, userName }): string` — persona (a sharp relationship strategist for Orbit; confirm before acting; probe & coach; never invent contacts), embeds snapshot + memory.
- [ ] Test: includes the snapshot + memory text; mentions the confirm rule.
- [ ] Run vitest; commit.

### Task 4: Profile memory

**Files:** Create `src/lib/chat/memory.actions.ts`.

- [ ] `getProfileMemory(): Promise<string>` — select `profile` from `user_context` by user; on any error (missing table) return `''`.
- [ ] `updateProfileMemory(transcript): Promise<void>` — `gpt-4o-mini` rewrites the profile from prior+exchange; upsert; never throws.
- [ ] No unit test (IO/LLM); covered manually. Commit.

### Task 5: Execute action

**Files:** Create `src/lib/chat/executeAction.ts`, `src/lib/chat/executeAction.test.ts`.

- [ ] Pure helper `resolveContact(name, contacts): Contact | { error }` (exact full-name, first-name, "name at company", ambiguous, not-found) — unit-tested with fixtures.
- [ ] `executeChatAction(action: ProposedAction): Promise<ActionResult>` — switch on type → existing actions (`addContact` building a full Contact like ContactModal; `addGoal` action; `addGoalMember`; `changeStatusLogged`/`setStatus`; `markMet`; `logResponse`; `markMessageSent`; `setFollowUp`; `scheduleMeeting`; `generateDraft`). Returns `{ ok, receipt, contact?/goal?/draft? }` or `{ ok:false, error }`.
- [ ] Test `resolveContact` branches; commit.

### Task 6: NDJSON splitter

**Files:** Create `src/lib/chat/ndjson.ts`, `src/lib/chat/ndjson.test.ts`.

- [ ] `createNdjsonParser()` returning `push(chunk): Event[]` buffering partial lines.
- [ ] Test: split across chunk boundaries; ignores blank lines. Commit.

### Task 7: Route handler

**Files:** Create `src/app/api/chat/route.ts`.

- [ ] POST: Clerk `auth()`; parse `{ messages }`; load contacts+goals (server actions) + memory; build system prompt. If no `OPEN_AI_KEY` → stream one `text` event + `done`.
- [ ] Stream `openai.chat.completions.create({ model:'gpt-4o', tools:CHAT_TOOLS, stream:true, messages })`; forward text deltas as `{type:'text',delta}`; accumulate tool_call deltas; at end emit `{type:'proposals',proposals}` then `{type:'done'}`. Wrap in `ReadableStream`; `Content-Type: application/x-ndjson`.
- [ ] Manual verify later. Commit.

### Task 8: chatStore actions field

**Files:** Modify `src/lib/chatStore.ts`.

- [ ] Extend assistant `StoredMsg` with `actions?: StoredAction[]` (`{id,type,args,status,receipt?}`). Add `updateMessageActions(sessionId, msgIndex, actions)` that upserts + persists.
- [ ] Existing chatStore tests still pass. Commit.

### Task 9: Chat client rewrite

**Files:** Modify `src/app/(app)/chat/page.tsx`.

- [ ] Remove add-person/add-goal buttons, modals, the heuristic `buildReply`, and the local `detectProposal`. Keep the onboarding `?q=` handoff (now streams).
- [ ] `send()` POSTs to `/api/chat`, reads the NDJSON stream, appends streamed text to the assistant bubble live, then renders proposal cards.
- [ ] Proposal card: shows the action summary + Confirm/Cancel; Confirm calls `executeChatAction`, updates stores, morphs to a green receipt; persists via `updateMessageActions`.
- [ ] Soft caret while streaming; typing indicator before first token; animate cards.
- [ ] Manual verify. Commit.

### Task 10: Wire memory + polish

- [ ] After each completed turn, fire-and-forget `updateProfileMemory`.
- [ ] `npm run build`, `npx eslint`, `npm test` all green. Commit.

---

## Self-review notes
- Spec coverage: snapshot (T1), tools/proposals (T2), prompt+persona/probe (T3), memory (T4,T10), confirm-execute + name resolution (T5), streaming protocol (T6,T7,T9), persistence (T8,T9), UX/motion + button removal (T9), degradation (T4,T7). ✓
- Memory table may not exist yet → all memory IO is try/catch returning empty, so the suite and app stay green pre-migration.
- LLM/route/IO are verified by running the app; pure logic is unit-tested.
