'use client';

import { useCallback, useRef, useState } from 'react';
import { generateDraft } from '@/lib/ai.actions';
import type { MoveKind } from '@/lib/nextMoves';

export interface ComposerState {
  title: string;
  draft: string;
  loading: boolean;
}

interface OpenOpts {
  title: string;
  contactId: string;
  kind?: MoveKind | 'message';
  /** Shown immediately and kept if the AI call fails or no key is set. */
  fallback: string;
}

/**
 * Drives the DraftModal: opens instantly with a heuristic fallback, then swaps
 * in the OpenAI-generated message when it arrives. Gracefully keeps the
 * fallback if the API is unavailable, so the Draft button always works.
 */
export function useDraftComposer() {
  const [state, setState] = useState<ComposerState | null>(null);
  const reqId = useRef(0);

  const open = useCallback(async ({ title, contactId, kind = 'message', fallback }: OpenOpts) => {
    const id = ++reqId.current;
    setState({ title, draft: fallback, loading: true });
    try {
      const text = await generateDraft(contactId, kind);
      if (reqId.current !== id) return; // superseded or closed
      setState((s) => (s ? { ...s, draft: text, loading: false } : s));
    } catch {
      if (reqId.current !== id) return;
      setState((s) => (s ? { ...s, loading: false } : s)); // keep the fallback
    }
  }, []);

  const close = useCallback(() => {
    reqId.current++; // ignore any in-flight result
    setState(null);
  }, []);

  return { state, open, close };
}
