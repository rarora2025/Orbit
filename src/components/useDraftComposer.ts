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
