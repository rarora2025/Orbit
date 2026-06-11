# Draft Message Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Orbit's outreach workflow — Draft Message → Save Draft / Mark Sent → Timeline updates → Move to Pending → Schedule Follow-up — on the existing JSONB contact storage.

**Architecture:** Approach A (adapt to the existing JSONB blob; interactions stay embedded, no DB migration) + A1 (keep OpenAI generation with a deterministic instant fallback). New pure helpers (`generateDraftMessage`, `getNextAction`, `followUpLabel`) drive a richer `DraftModal`; two new server actions append interactions and flip status; the zustand store fans the updated contact out to every view.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, zustand, Supabase (service-role, JSONB blob), Clerk auth, OpenAI, vitest.

**Reference:** Spec at `docs/superpowers/specs/2026-06-11-draft-message-workflow-design.md`. Per `AGENTS.md`, this Next.js version differs from training data — server actions already follow the established `'use server'` + `auth()` pattern in `src/lib/contacts.actions.ts`; mirror it.

---

## File Structure

- `src/lib/mockData.ts` (modify) — extend `Interaction` type, add `nextFollowUpAt` to `Contact`, add pure helpers `getNextAction`, `followUpLabel`, and `INTERACTION_LABEL`.
- `src/lib/draftMessage.ts` (create) — `Tone`, `Channel`, `generateDraftMessage`.
- `src/lib/draftMessage.test.ts` (create) — tests for `generateDraftMessage`.
- `src/lib/contactDerive.test.ts` (create) — tests for `getNextAction` + `followUpLabel`.
- `src/lib/contacts.actions.ts` (modify) — `addDraftInteraction`, `markMessageSent`.
- `src/lib/store.ts` (modify) — `saveDraft`, `markSent` store methods.
- `src/lib/store.test.ts` (modify) — extend the `contacts.actions` mock.
- `src/lib/ai.actions.ts` (modify) — optional `tone`/`channel` params on `generateDraft`.
- `src/components/useDraftComposer.ts` (modify) — own `contact` + `tone` + `channel`; expose `setTone`/`setChannel`.
- `src/components/DraftModal.tsx` (modify) — channel + tone selectors, Copy / Save Draft / Mark Sent / Cancel.
- `src/components/ContactDetailPanel.tsx` (modify) — derived next action, follow-up line, shared labels, draft opens with contact.
- `src/app/(app)/dashboard/page.tsx` (modify) — wire new composer + modal callbacks.
- `src/app/(app)/page.tsx` (modify) — wire Insights cards through the new composer/modal.
- `src/components/ContactTable.tsx` (modify) — use `getNextAction`.

---

## Task 1: Data model + derived helpers

**Files:**
- Modify: `src/lib/mockData.ts`
- Test: `src/lib/contactDerive.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/contactDerive.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getNextAction, followUpLabel } from './mockData';
import type { Contact, Status } from './mockData';

function makeContact(over: Partial<Contact> & { id: string; status: Status }): Contact {
  return {
    position: 1000, name: 'Vinit Shah', company: '', role: '', linkedinUrl: '',
    email: '', inquiry: '', notes: '', priority: 'Medium', score: 50, warmth: 'Medium',
    avatarColor: '', tags: [], lastContacted: '', nextAction: '', aiSummary: '',
    outreachAngle: '', suggestedMessage: '', interactions: [], ...over,
  };
}

describe('getNextAction', () => {
  it('uses the contact name for Send', () => {
    expect(getNextAction(makeContact({ id: 'a', status: 'Send' }))).toBe('Send first message to Vinit Shah');
  });
  it('maps each status to its action', () => {
    const cases: [Status, string][] = [
      ['Pending', 'Follow up if no response'],
      ['Response', 'Schedule meeting or reply'],
      ['Meeting Scheduled', 'Prepare for meeting'],
      ['Met', 'Add notes and decide follow-up'],
      ['Ghosted', 'Decide whether to revive'],
      ['Long-term', 'Keep warm over time'],
    ];
    for (const [status, expected] of cases) {
      expect(getNextAction(makeContact({ id: 's', status }))).toBe(expected);
    }
  });
});

describe('followUpLabel', () => {
  const today = new Date('2026-06-11T12:00:00Z');
  it('returns null when no follow-up date', () => {
    expect(followUpLabel(makeContact({ id: 'a', status: 'Pending' }), today)).toBeNull();
  });
  it('says "Follow up today" when pending and due today', () => {
    expect(followUpLabel(makeContact({ id: 'a', status: 'Pending', nextFollowUpAt: '2026-06-11T09:00:00Z' }), today)).toBe('Follow up today');
  });
  it('says overdue when pending and past', () => {
    expect(followUpLabel(makeContact({ id: 'a', status: 'Pending', nextFollowUpAt: '2026-06-01T09:00:00Z' }), today)).toBe('Follow-up overdue');
  });
  it('shows the date otherwise', () => {
    const label = followUpLabel(makeContact({ id: 'a', status: 'Pending', nextFollowUpAt: '2026-06-20T09:00:00Z' }), today);
    expect(label).toMatch(/^Follow up on /);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/contactDerive.test.ts`
Expected: FAIL — `getNextAction`/`followUpLabel` are not exported.

- [ ] **Step 3: Implement the model changes**

In `src/lib/mockData.ts`, change the `Interaction` interface to add the new types + channel:

```ts
export interface Interaction {
  id: string;
  date: string;
  type:
    | 'sent' | 'received' | 'note' | 'meeting'
    | 'message_drafted' | 'message_sent' | 'follow_up_scheduled';
  channel?: string;
  content: string;
}
```

In the `Contact` interface, add after `lastContacted: string;`:

```ts
  /** ISO timestamp for the next scheduled follow-up (spec: next_follow_up_at). */
  nextFollowUpAt?: string;
```

Add these exports at the end of the file:

```ts
/** Human-readable timeline labels for every interaction type. */
export const INTERACTION_LABEL: Record<string, string> = {
  message_drafted: 'Drafted outreach message',
  message_sent: 'Marked message as sent',
  follow_up_scheduled: 'Follow-up scheduled',
  response_logged: 'Response logged',
  meeting_scheduled: 'Meeting scheduled',
  note_added: 'Note added',
  sent: 'Sent',
  received: 'Received',
  note: 'Note',
  meeting: 'Meeting',
};

/** The single next step for a contact, derived from status (never stored). */
export function getNextAction(contact: Contact): string {
  const name = contact.name || 'this contact';
  switch (contact.status) {
    case 'Send': return `Send first message to ${name}`;
    case 'Pending': return 'Follow up if no response';
    case 'Response': return 'Schedule meeting or reply';
    case 'Meeting Scheduled': return 'Prepare for meeting';
    case 'Met': return 'Add notes and decide follow-up';
    case 'Ghosted': return 'Decide whether to revive';
    case 'Long-term': return 'Keep warm over time';
    default: return `Reach out to ${name}`;
  }
}

/** Follow-up status line for the detail panel, or null when there's nothing to show. */
export function followUpLabel(contact: Contact, today: Date = new Date()): string | null {
  if (!contact.nextFollowUpAt) return null;
  const due = new Date(contact.nextFollowUpAt);
  if (Number.isNaN(due.getTime())) return null;
  if (contact.status === 'Pending') {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dueDay = startOfDay(due);
    const todayDay = startOfDay(today);
    if (dueDay === todayDay) return 'Follow up today';
    if (dueDay < todayDay) return 'Follow-up overdue';
  }
  return `Follow up on ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/contactDerive.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mockData.ts src/lib/contactDerive.test.ts
git commit -m "feat: derived next-action, follow-up label, interaction types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Deterministic draft generator

**Files:**
- Create: `src/lib/draftMessage.ts`
- Test: `src/lib/draftMessage.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/draftMessage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateDraftMessage, type Tone, type Channel } from './draftMessage';
import type { Contact } from './mockData';

function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    id: 'a', position: 1000, name: 'Vinit Shah', company: 'Mojo', role: 'Founder',
    linkedinUrl: '', email: '', inquiry: '', notes: '', status: 'Send', priority: 'Medium',
    score: 50, warmth: 'Medium', avatarColor: '', tags: [], lastContacted: '', nextAction: '',
    aiSummary: '', outreachAngle: '', suggestedMessage: '', interactions: [],
    relationshipGoal: 'learn about sports betting products', ...over,
  };
}

describe('generateDraftMessage', () => {
  it('greets the contact by first name', () => {
    expect(generateDraftMessage(makeContact(), 'Casual', 'Email')).toContain('Vinit');
  });
  it('never leaves placeholder brackets', () => {
    for (const tone of ['Short', 'Casual', 'Professional'] as Tone[]) {
      for (const channel of ['Email', 'LinkedIn', 'Text'] as Channel[]) {
        expect(generateDraftMessage(makeContact(), tone, channel)).not.toMatch(/[[\]]/);
      }
    }
  });
  it('varies output by tone', () => {
    const short = generateDraftMessage(makeContact(), 'Short', 'Email');
    const pro = generateDraftMessage(makeContact(), 'Professional', 'Email');
    expect(short).not.toBe(pro);
  });
  it('incorporates the relationship goal when present', () => {
    const msg = generateDraftMessage(makeContact({ relationshipGoal: 'sports betting products' }), 'Casual', 'Email');
    expect(msg).toContain('sports betting products');
  });
  it('falls back to a sensible greeting for an empty name', () => {
    expect(generateDraftMessage(makeContact({ name: '' }), 'Short', 'Text')).toContain('there');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/draftMessage.test.ts`
Expected: FAIL — module `./draftMessage` does not exist.

- [ ] **Step 3: Implement the generator**

Create `src/lib/draftMessage.ts`:

```ts
import type { Contact } from './mockData';

export type Tone = 'Short' | 'Casual' | 'Professional';
export type Channel = 'Email' | 'LinkedIn' | 'Text';

export const TONES: Tone[] = ['Short', 'Casual', 'Professional'];
export const CHANNELS: Channel[] = ['Email', 'LinkedIn', 'Text'];

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

/** A specific, bracket-free reason to connect, drawn from the contact's fields. */
function reason(contact: Contact): string {
  const goal = contact.relationshipGoal?.trim();
  const notes = contact.notes?.trim();
  if (goal) return goal;
  if (notes) return notes;
  if (contact.role && contact.company) return `your work as ${contact.role} at ${contact.company}`;
  if (contact.company) return `your work at ${contact.company}`;
  if (contact.role) return `your work as ${contact.role}`;
  return 'your work';
}

/**
 * Deterministic outreach draft used as the instant fallback before the OpenAI
 * draft lands (and kept if OpenAI is unavailable). Pure — no network, no random.
 */
export function generateDraftMessage(contact: Contact, tone: Tone, channel: Channel): string {
  const name = firstName(contact.name);
  const r = reason(contact);
  const greeting = channel === 'Text' ? `Hey ${name}` : `Hi ${name}`;
  const closer = channel === 'Email' ? '\n\nBest' : '';

  if (tone === 'Short') {
    return `${greeting} — really admire ${r}. Would love to connect.${closer}`;
  }
  if (tone === 'Professional') {
    return `${greeting},\n\nI've been following ${r} and would welcome the chance to connect. I'd value your perspective and am happy to find a time that works for you.${closer}`;
  }
  return `${greeting}! I came across ${r} and thought it was genuinely interesting — would love to connect sometime.${closer}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/draftMessage.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/draftMessage.ts src/lib/draftMessage.test.ts
git commit -m "feat: deterministic draft message generator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Server actions to persist interactions

**Files:**
- Modify: `src/lib/contacts.actions.ts`

- [ ] **Step 1: Add the interaction-writing actions**

In `src/lib/contacts.actions.ts`, update the type import line and add the two actions at the end of the file. Change the existing import:

```ts
import type { Contact, Status, Interaction } from './mockData';
```

Append:

```ts
export interface InteractionInput {
  channel: string;
  content: string;
}

function buildInteraction(type: Interaction['type'], input: InteractionInput, at: Date): Interaction {
  return {
    id: crypto.randomUUID(),
    date: at.toISOString(),
    type,
    channel: input.channel,
    content: input.content,
  };
}

/** Append a "message_drafted" interaction. Does NOT change status. */
export async function addDraftInteraction(contactId: string, input: InteractionInput): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find((c) => c.id === contactId);
  if (!current) throw new Error('Contact not found');
  const interaction = buildInteraction('message_drafted', input, new Date());
  const merged: Contact = { ...current, interactions: [...current.interactions, interaction] };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', contactId)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}

/**
 * Append "message_sent" + "follow_up_scheduled" interactions and advance the
 * contact: status -> Pending, lastContacted = now, nextFollowUpAt = now + 7 days.
 */
export async function markMessageSent(contactId: string, input: InteractionInput): Promise<Contact> {
  const userId = await requireUserId();
  const existing = await listContacts();
  const current = existing.find((c) => c.id === contactId);
  if (!current) throw new Error('Contact not found');

  const now = new Date();
  const sent = buildInteraction('message_sent', input, now);
  const followUp = buildInteraction(
    'follow_up_scheduled',
    { channel: input.channel, content: 'Follow up if no response in 7 days' },
    new Date(now.getTime() + 1), // 1ms later so it sorts just after the sent entry
  );
  const nextFollowUpAt = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const merged: Contact = {
    ...current,
    status: 'Pending',
    lastContacted: now.toISOString(),
    nextFollowUpAt,
    interactions: [...current.interactions, sent, followUp],
  };
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', contactId)
    .select('id, position, data')
    .single();
  if (error) throw error;
  return rowToContact(data as Row);
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (`Status` import remains used by `moveContact`; `Interaction` now used).

- [ ] **Step 3: Commit**

```bash
git add src/lib/contacts.actions.ts
git commit -m "feat: server actions to persist draft and sent interactions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Store methods (saveDraft / markSent)

**Files:**
- Modify: `src/lib/store.ts`
- Test: `src/lib/store.test.ts`

- [ ] **Step 1: Update the test mock and add a behavior test**

In `src/lib/store.test.ts`, replace the `vi.mock('./contacts.actions', ...)` block with one that includes the new actions:

```ts
vi.mock('./contacts.actions', () => ({
  addContact: vi.fn(),
  updateContact: vi.fn(),
  moveContact: vi.fn(),
  deleteContact: vi.fn(),
  listContacts: vi.fn(),
  addDraftInteraction: vi.fn(),
  markMessageSent: vi.fn(),
}));
```

Add this test inside the file (after the existing `describe` block), and add `import * as api from './contacts.actions';` near the top imports:

```ts
describe('useCRMStore interactions', () => {
  it('markSent upserts the returned contact (moving it to Pending)', async () => {
    const moved = c('a', 'Pending', 1000);
    (api.markMessageSent as ReturnType<typeof vi.fn>).mockResolvedValue(moved);
    useCRMStore.setState({ contacts: [c('a', 'Send', 1000)], loaded: true });
    await useCRMStore.getState().markSent('a', { channel: 'Email', content: 'hi' });
    expect(useCRMStore.getState().contacts.find((x) => x.id === 'a')?.status).toBe('Pending');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/store.test.ts`
Expected: FAIL — `markSent` is not a function on the store.

- [ ] **Step 3: Implement the store methods**

In `src/lib/store.ts`, add to the `CRMStore` interface (after `deleteContact`):

```ts
  saveDraft: (contactId: string, input: { channel: string; content: string }) => Promise<void>;
  markSent: (contactId: string, input: { channel: string; content: string }) => Promise<void>;
```

And in the returned object (after `deleteContact`):

```ts
    saveDraft: async (contactId, input) => { upsertLocal(await api.addDraftInteraction(contactId, input)); },
    markSent: async (contactId, input) => { upsertLocal(await api.markMessageSent(contactId, input)); },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: store saveDraft and markSent methods

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: OpenAI generator honors tone + channel

**Files:**
- Modify: `src/lib/ai.actions.ts`

- [ ] **Step 1: Add tone/channel params**

In `src/lib/ai.actions.ts`, add the type import:

```ts
import type { Tone, Channel } from './draftMessage';
```

Change the `generateDraft` signature and prompt assembly:

```ts
export async function generateDraft(
  contactId: string,
  kind: MoveKind | 'message' = 'message',
  tone?: Tone,
  channel?: Channel,
): Promise<string> {
  const openai = openaiClient();
  if (!openai) throw new Error('OPEN_AI_KEY not configured');

  const contact = await fetchContact(contactId);
  if (!contact) throw new Error('Contact not found');

  const me = await currentUser();
  const myName = me?.firstName || me?.fullName || '';

  const intent = KIND_INTENT[kind] ?? KIND_INTENT.message;
  const lastNote = contact.interactions.at(-1)?.content ?? '';
  const userPrompt = [
    `Write ${intent} to ${contact.name}${contact.role ? `, ${contact.role}` : ''}${contact.company ? ` at ${contact.company}` : ''}.`,
    channel ? `It will be sent via ${channel}, so match that medium's length and formality.` : '',
    tone ? `Tone: ${tone}.` : '',
    myName ? `The message is from me, ${myName} — sign it off with my name.` : '',
    contact.relationshipGoal ? `My goal with this relationship: ${contact.relationshipGoal}.` : '',
    contact.tags.length ? `Relevant context tags: ${contact.tags.join(', ')}.` : '',
    lastNote ? `Most recent interaction: "${lastNote}".` : '',
    'Keep it under 120 words, natural and specific. Never use placeholders such as [Name], [Your name], or [Company]. Return only the message body.',
  ].filter(Boolean).join('\n');
```

(Leave the rest of the function — the `openai.chat.completions.create` call and return — unchanged.)

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai.actions.ts
git commit -m "feat: pass tone and channel to OpenAI draft generation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Composer owns contact + tone + channel

**Files:**
- Modify: `src/components/useDraftComposer.ts`

- [ ] **Step 1: Rewrite the composer hook**

Replace the entire contents of `src/components/useDraftComposer.ts` with:

```ts
'use client';

import { useCallback, useRef, useState } from 'react';
import { generateDraft } from '@/lib/ai.actions';
import { generateDraftMessage, type Tone, type Channel } from '@/lib/draftMessage';
import type { MoveKind } from '@/lib/nextMoves';
import type { Contact } from '@/lib/mockData';

export interface ComposerState {
  title: string;
  contact: Contact;
  tone: Tone;
  channel: Channel;
  draft: string;
  loading: boolean;
}

interface OpenOpts {
  contact: Contact;
  kind?: MoveKind | 'message';
  tone?: Tone;
  channel?: Channel;
}

const DEFAULT_TONE: Tone = 'Casual';
const DEFAULT_CHANNEL: Channel = 'Email';

/**
 * Drives the DraftModal: shows a deterministic draft instantly, then swaps in
 * the OpenAI-generated message when it lands. Owns the selected contact, tone,
 * and channel so the modal's selectors can re-generate. Keeps the deterministic
 * draft if OpenAI is unavailable, so the Draft button always works.
 */
export function useDraftComposer() {
  const [state, setState] = useState<ComposerState | null>(null);
  const reqId = useRef(0);
  const ctx = useRef<{ contact: Contact; kind: MoveKind | 'message'; tone: Tone; channel: Channel } | null>(null);

  const generate = useCallback((contact: Contact, kind: MoveKind | 'message', tone: Tone, channel: Channel) => {
    const id = ++reqId.current;
    ctx.current = { contact, kind, tone, channel };
    setState({
      title: `Draft outreach to ${contact.name}`,
      contact, tone, channel,
      draft: generateDraftMessage(contact, tone, channel),
      loading: true,
    });
    generateDraft(contact.id, kind, tone, channel)
      .then((text) => { if (reqId.current === id) setState((s) => (s ? { ...s, draft: text, loading: false } : s)); })
      .catch(() => { if (reqId.current === id) setState((s) => (s ? { ...s, loading: false } : s)); });
  }, []);

  const open = useCallback((opts: OpenOpts) => {
    generate(opts.contact, opts.kind ?? 'message', opts.tone ?? DEFAULT_TONE, opts.channel ?? DEFAULT_CHANNEL);
  }, [generate]);

  const setTone = useCallback((tone: Tone) => {
    const c = ctx.current;
    if (c) generate(c.contact, c.kind, tone, c.channel);
  }, [generate]);

  const setChannel = useCallback((channel: Channel) => {
    const c = ctx.current;
    if (c) generate(c.contact, c.kind, c.tone, channel);
  }, [generate]);

  const close = useCallback(() => {
    reqId.current++; // ignore any in-flight result
    ctx.current = null;
    setState(null);
  }, []);

  return { state, open, setTone, setChannel, close };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `DraftModal.tsx`, `dashboard/page.tsx`, and `page.tsx` (callers updated in Tasks 7–9). No errors inside `useDraftComposer.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/components/useDraftComposer.ts
git commit -m "feat: composer owns contact, tone, and channel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: DraftModal — selectors + Save Draft / Mark Sent

**Files:**
- Modify: `src/components/DraftModal.tsx`

- [ ] **Step 1: Rewrite the modal**

Replace the entire contents of `src/components/DraftModal.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { X, Copy, Check, Loader2, Send } from 'lucide-react';
import { TONES, CHANNELS, type Tone, type Channel } from '@/lib/draftMessage';

interface Props {
  /** Headline, e.g. "Draft outreach to Vinit Shah". */
  title: string;
  /** Message text — editable in place. Updated when tone/channel change or AI lands. */
  draft: string;
  tone: Tone;
  channel: Channel;
  /** True while OpenAI is generating; the deterministic draft shows meanwhile. */
  loading?: boolean;
  onToneChange: (tone: Tone) => void;
  onChannelChange: (channel: Channel) => void;
  onSaveDraft: (input: { channel: string; content: string }) => Promise<void>;
  onMarkSent: (input: { channel: string; content: string }) => Promise<void>;
  onClose: () => void;
}

export default function DraftModal({
  title, draft, tone, channel, loading,
  onToneChange, onChannelChange, onSaveDraft, onMarkSent, onClose,
}: Props) {
  const [text, setText] = useState(draft);
  // Sync the editor when the draft prop changes (tone/channel change or AI swap)
  // — React's endorsed "adjust state during render" pattern.
  const [prevDraft, setPrevDraft] = useState(draft);
  if (draft !== prevDraft) { setPrevDraft(draft); setText(draft); }

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function saveDraft() {
    setBusy(true);
    try {
      await onSaveDraft({ channel, content: text });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  async function markSent() {
    setBusy(true);
    try {
      await onMarkSent({ channel, content: text });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-stone-200 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-stone-900 text-base truncate">{title}</h2>
            {loading && (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-orange-500 flex-shrink-0">
                <Loader2 size={13} className="animate-spin" />
                Writing…
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Segmented label="Channel" options={CHANNELS} value={channel} onChange={(v) => onChannelChange(v as Channel)} />
            <Segmented label="Tone" options={TONES} value={tone} onChange={(v) => onToneChange(v as Tone)} />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className={`w-full resize-none bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 leading-relaxed focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-colors ${loading ? 'opacity-60' : ''}`}
          />
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
            Cancel
          </button>
          {saved && <span className="text-[13px] font-medium text-emerald-600 inline-flex items-center gap-1"><Check size={14} /> Saved</span>}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 hover:text-stone-800 transition active:scale-95 disabled:opacity-50"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition active:scale-95 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={markSent}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30 disabled:opacity-50"
            >
              <Send size={15} />
              Mark Sent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Segmented({ label, options, value, onChange }: {
  label: string; options: readonly string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{label}</span>
      <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors ${
              value === opt ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `dashboard/page.tsx` and `page.tsx` (they pass the old `DraftModal` props — fixed in Tasks 8–9). `DraftModal.tsx` itself is clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/DraftModal.tsx
git commit -m "feat: draft modal channel/tone selectors and save/sent actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Detail panel — derived next action, follow-up, labels

**Files:**
- Modify: `src/components/ContactDetailPanel.tsx`

- [ ] **Step 1: Update imports and the `onDraft` prop type**

In `src/components/ContactDetailPanel.tsx`, change the imports:

```tsx
import { Contact, columnConfig, getNextAction, followUpLabel, INTERACTION_LABEL } from '@/lib/mockData';
```

Change the `Props` interface `onDraft` line to pass the whole contact:

```tsx
  onDraft: (contact: Contact) => void;
```

Remove the local `INTERACTION_LABEL` constant (lines defining it) — it now comes from `mockData`.

- [ ] **Step 2: Replace the draft handler and follow-up derivation**

Replace the `draftNextAction` function with:

```tsx
  function draftNextAction() {
    if (c) onDraft(c);
  }
```

After the `timeline` declaration near the top of the component, add:

```tsx
  const followUp = c ? followUpLabel(c) : null;
```

- [ ] **Step 3: Use the derived next action + follow-up line**

In the "Next action" section, replace the action paragraph:

```tsx
                    <p className="text-sm text-stone-700 leading-relaxed">
                      {getNextAction(c)}
                    </p>
                    {followUp && (
                      <p className="text-[12px] font-medium text-orange-600 mt-1.5">{followUp}</p>
                    )}
```

(This replaces the previous `{c.nextAction || ...}` paragraph and the `{c.actionNote && ...}` line.)

- [ ] **Step 4: Use shared interaction labels**

The timeline already renders `INTERACTION_LABEL[it.type] ?? it.type` — now resolved from the shared `mockData` map, so the new types display correctly. No change needed beyond the import. Verify the line reads:

```tsx
                              <span className="text-[12px] font-semibold text-stone-700">{INTERACTION_LABEL[it.type] ?? it.type}</span>
```

- [ ] **Step 5: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `dashboard/page.tsx` and `page.tsx` (the `onDraft` callers, fixed next).

- [ ] **Step 6: Commit**

```bash
git add src/components/ContactDetailPanel.tsx
git commit -m "feat: detail panel derived next action and follow-up line

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Wire dashboard, Insights, and the table

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/components/ContactTable.tsx`

- [ ] **Step 1: Wire the dashboard page**

In `src/app/(app)/dashboard/page.tsx`, pull `saveDraft` and `markSent` from the store:

```tsx
  const { contacts, loaded, selectedContactId, selectContact, addContact, updateContact, moveContact, deleteContact, saveDraft, markSent } = useCRMStore();
```

Change the detail panel's `onDraft` to pass the contact:

```tsx
        onDraft={(contact) => composer.open({ contact })}
```

Replace the `<DraftModal ... />` block at the bottom with:

```tsx
      {/* Draft composer */}
      {composer.state && (
        <DraftModal
          title={composer.state.title}
          draft={composer.state.draft}
          tone={composer.state.tone}
          channel={composer.state.channel}
          loading={composer.state.loading}
          onToneChange={composer.setTone}
          onChannelChange={composer.setChannel}
          onSaveDraft={(input) => saveDraft(composer.state!.contact.id, input)}
          onMarkSent={(input) => markSent(composer.state!.contact.id, input)}
          onClose={composer.close}
        />
      )}
```

- [ ] **Step 2: Wire the Insights page**

In `src/app/(app)/page.tsx`, pull the new store methods:

```tsx
  const { contacts, loaded, updateContact, saveDraft, markSent } = useCRMStore();
```

Change the `MoveCard`'s `onDraft` so it opens the composer with the contact (it already computes `c` in the `.map`):

```tsx
                    onDraft={() => { if (c) composer.open({ contact: c, kind: move.kind }); }}
```

Replace the `<DraftModal ... />` block at the bottom with:

```tsx
      {composer.state && (
        <DraftModal
          title={composer.state.title}
          draft={composer.state.draft}
          tone={composer.state.tone}
          channel={composer.state.channel}
          loading={composer.state.loading}
          onToneChange={composer.setTone}
          onChannelChange={composer.setChannel}
          onSaveDraft={(input) => saveDraft(composer.state!.contact.id, input)}
          onMarkSent={(input) => markSent(composer.state!.contact.id, input)}
          onClose={composer.close}
        />
      )}
```

- [ ] **Step 3: Wire the table view**

In `src/components/ContactTable.tsx`, add `getNextAction` to the `mockData` import (find the existing `from '@/lib/mockData'` import and add it; if there is none, add `import { getNextAction } from '@/lib/mockData';`). Then change line ~147 from:

```tsx
                      {contact.nextAction}
```

to:

```tsx
                      {getNextAction(contact)}
```

- [ ] **Step 4: Full type-check, lint, and tests**

Run: `npx tsc --noEmit`
Expected: no errors anywhere.

Run: `npm run lint`
Expected: no errors.

Run: `npm test`
Expected: all suites pass (including the new `draftMessage`, `contactDerive`, and updated `store` tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx src/app/(app)/page.tsx src/components/ContactTable.tsx
git commit -m "feat: wire draft workflow into dashboard, insights, and table

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Manual verification

**Files:** none (manual run)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open http://localhost:3000/dashboard

- [ ] **Step 2: Walk the workflow**

1. Click a contact in the **To send** column → detail panel opens; "Next action" reads "Send first message to {name}".
2. Click **Draft message** → modal titled "Draft outreach to {name}" with Channel (Email/LinkedIn/Text) and Tone (Short/Casual/Professional) selectors and a generated draft. Change tone/channel → draft regenerates.
3. Click **Save Draft** → inline "Saved" appears; panel timeline shows "Drafted outreach message"; the card stays in To send (status unchanged).
4. Click **Mark Sent** → modal closes; the card moves to the **Pending** column; column counts update; the detail panel stays open and now shows "Marked message as sent" + "Follow-up scheduled" in the timeline; "Next action" reads "Follow up if no response"; a "Follow up on {date}" line (~7 days out) appears.

- [ ] **Step 3: Confirm nothing else broke**

Visit `/` (Insights) — "Draft message" on a move card opens the same modal and Save/Mark Sent work. Visit `/chat` — loads normally. Reload `/dashboard` — the moved contact persists in Pending with its timeline (data survived the round-trip to Supabase).

---

## Self-Review Notes

- **Spec coverage:** #1 storage → Task 3 (interactions persistable; migration N/A per design); #2 modal → Task 7; #3 `generateDraftMessage` → Task 2; #4 Save Draft → Tasks 3/4/7; #5 Mark Sent (sent + status→Pending + dates + follow_up_scheduled) → Tasks 3/4/7; #6 timeline labels → Tasks 1/8; #7 `getNextAction` → Tasks 1/8; #8 follow-up display → Tasks 1/8; #9 styling preserved → Tasks 7/8; #10 don't break other tabs → Tasks 9/10. A1 (OpenAI + tone/channel) → Tasks 5/6.
- **Type consistency:** `InteractionInput`/`{ channel, content }` used identically across actions (Task 3), store (Task 4), and modal callbacks (Task 7). `Tone`/`Channel` defined in Task 2 and imported everywhere. `onDraft(contact)` signature defined in Task 8 and called in Task 9. `saveDraft`/`markSent` names consistent across Tasks 4 and 9.
- **No placeholders:** every code step shows complete code.
