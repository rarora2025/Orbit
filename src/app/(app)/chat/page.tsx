'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCRMStore } from '@/lib/store';
import { useChatStore, type StoredAction, type StoredMsg } from '@/lib/chatStore';
import { useGoalsStore } from '@/lib/goalsStore';
import { Contact, columnConfig } from '@/lib/mockData';
import { Send, Star, Plus, MessageCircle, Trash2, Check, X } from 'lucide-react';
import OrbitLogo from '@/components/OrbitLogo';
import CompanyLogo from '@/components/CompanyLogo';
import ChatMarkdown from '@/components/ChatMarkdown';
import { CHAT_SUGGESTIONS as SUGGESTIONS } from '@/lib/chatSuggestions';
import { describeAction, type ChatStreamEvent, type ProposedAction } from '@/lib/chat/tools';
import { createNdjsonParser } from '@/lib/chat/ndjson';
import { executeChatAction } from '@/lib/chat/executeAction';
import { updateProfileMemory } from '@/lib/chat/memory.actions';
import { listContacts } from '@/lib/contacts.actions';
import { listGoals } from '@/lib/goals.actions';

const TEMP_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

/** Read the NDJSON stream from /api/chat, dispatching each event. */
async function streamChat(messages: { role: string; content: string }[], onEvent: (e: ChatStreamEvent) => void) {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
  } catch {
    onEvent({ type: 'error', message: 'Network error reaching the assistant.' });
    onEvent({ type: 'done' });
    return;
  }
  if (!res.ok || !res.body) {
    onEvent({ type: 'error', message: 'The assistant is unavailable right now.' });
    onEvent({ type: 'done' });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = createNdjsonParser();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const ev of parser.push(decoder.decode(value, { stream: true }))) onEvent(ev as ChatStreamEvent);
  }
  for (const ev of parser.flush()) onEvent(ev as ChatStreamEvent);
}

function ContactRef({ contact }: { contact: Contact }) {
  const cfg = columnConfig[contact.status] ?? { dot: 'bg-stone-400' };
  const initial = (contact.company || contact.name || '?').charAt(0).toUpperCase();
  const temp = TEMP_LEVEL[contact.warmth] ?? 1;
  const sub = [contact.role, contact.company].filter(Boolean).join(' · ');
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-2.5 py-2 shadow-sm">
      <CompanyLogo
        company={contact.company}
        fallbackInitial={initial}
        fallbackColor={contact.company ? 'bg-stone-100 text-stone-500' : contact.avatarColor}
        className="w-8 h-8 rounded-lg border border-stone-200 flex-shrink-0 p-1"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-stone-900 leading-tight truncate">{contact.name}</p>
        {sub && <p className="text-[12px] text-stone-500 leading-tight truncate">{sub}</p>}
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0" title={`Temperature: ${contact.warmth}`}>
        {[1, 2, 3].map(i => (
          <Star key={i} size={11} className={i <= temp ? 'fill-orange-400 text-orange-400' : 'fill-stone-100 text-stone-200'} />
        ))}
      </div>
      <span className="flex items-center gap-1 flex-shrink-0 rounded-full bg-stone-100 pl-2 pr-2.5 py-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        <span className="text-[11px] font-medium text-stone-600">{contact.status}</span>
      </span>
    </div>
  );
}

// Guards the onboarding handoff against React's dev double-mount.
let consumedHandoffQ: string | null = null;

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1 rounded-3xl bg-white border border-stone-200/70" />}>
      <ChatInner />
    </Suspense>
  );
}

function ChatInner() {
  const router = useRouter();
  const handoffQ = useSearchParams().get('q');
  const setContacts = useCRMStore(s => s.setContacts);
  const { saveDraft, markSent } = useCRMStore();
  const setGoals = useGoalsStore(s => s.setGoals);
  const { sessions, activeId, newChat, selectChat, deleteChat, addUserMessage, addAssistantMessage, updateMessageActions } = useChatStore();

  const [input, setInput] = useState('');
  // The in-flight assistant turn, held locally until the stream finishes.
  const [stream, setStream] = useState<{ text: string; proposals: ProposedAction[]; phase: 'thinking' | 'streaming' } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = sessions.find(s => s.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const contactsById = useCRMStore(s => s.contacts);
  const byId = new Map(contactsById.map(c => [c.id, c]));
  const busy = stream !== null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, stream]);

  async function refreshStores() {
    const [c, g] = await Promise.all([listContacts().catch(() => null), listGoals().catch(() => null)]);
    if (c) setContacts(c);
    if (g) setGoals(g);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const sessionId = addUserMessage(q);
    setInput('');
    setStream({ text: '', proposals: [], phase: 'thinking' });

    // History = the session's messages (now including this user turn) for the model.
    const history = (useChatStore.getState().sessions.find(s => s.id === sessionId)?.messages ?? [])
      .map(m => ({ role: m.role, content: m.text }));

    let text2 = '';
    let proposals: ProposedAction[] = [];
    await streamChat(history, (ev) => {
      if (ev.type === 'text') {
        text2 += ev.delta;
        setStream({ text: text2, proposals, phase: 'streaming' });
      } else if (ev.type === 'proposals') {
        proposals = ev.proposals;
        setStream({ text: text2, proposals, phase: 'streaming' });
      } else if (ev.type === 'error') {
        text2 += (text2 ? '\n\n' : '') + ev.message;
        setStream({ text: text2, proposals, phase: 'streaming' });
      }
    });

    // Commit the finished assistant turn to the store.
    const messageId = crypto.randomUUID();
    const actions: StoredAction[] = proposals.map(p => ({ action: p, summary: describeAction(p), status: 'pending' as const }));
    addAssistantMessage(sessionId, {
      role: 'assistant',
      id: messageId,
      text: text2,
      ...(actions.length ? { actions } : {}),
    });
    setStream(null);

    if (text2) void updateProfileMemory({ user: q, assistant: text2 });
  }

  function messageActions(messageId: string): StoredAction[] {
    const m = messages.find(x => x.role === 'assistant' && x.id === messageId);
    return (m && m.role === 'assistant' && m.actions) || [];
  }

  async function confirmAction(messageId: string, actionId: string) {
    const current = messageActions(messageId);
    const idx = current.findIndex(a => a.action.id === actionId);
    if (idx < 0 || current[idx].status !== 'pending') return;
    const result = await executeChatAction(current[idx].action);
    const next = current.slice();
    next[idx] = result.ok
      ? { ...next[idx], status: 'confirmed', receipt: result.receipt, draft: result.draft, draftContactId: result.draftContactId }
      : { ...next[idx], status: 'failed', receipt: result.error };
    updateMessageActions(activeId!, messageId, next);
    if (result.ok) void refreshStores();
  }

  function cancelAction(messageId: string, actionId: string) {
    const current = messageActions(messageId);
    const idx = current.findIndex(a => a.action.id === actionId);
    if (idx < 0 || current[idx].status !== 'pending') return;
    const next = current.slice();
    next[idx] = { ...next[idx], status: 'cancelled' };
    updateMessageActions(activeId!, messageId, next);
  }

  const empty = messages.length === 0 && !busy && !handoffQ;

  // Onboarding handoff: stream the first question once, then clear the URL.
  useEffect(() => {
    if (!handoffQ) return;
    if (consumedHandoffQ !== handoffQ) {
      consumedHandoffQ = handoffQ;
      const q = handoffQ;
      queueMicrotask(() => { void send(q); });
    }
    router.replace('/chat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffQ]);

  return (
    <div className="flex-1 flex min-h-0 rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40 overflow-hidden">
      {/* History sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-stone-100 bg-stone-50/50">
        <div className="p-3 flex-shrink-0">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 text-[13px] font-semibold hover:border-orange-300 hover:text-orange-600 transition active:scale-[0.98]"
          >
            <Plus size={15} />
            New chat
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
          {sessions.length === 0 ? (
            <p className="text-[12px] text-stone-400 px-2 py-3 text-center">No conversations yet</p>
          ) : (
            sessions.map(s => {
              const isActive = s.id === activeId;
              return (
                <div
                  key={s.id}
                  onClick={() => selectChat(s.id)}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    isActive ? 'bg-white shadow-sm border border-stone-200' : 'hover:bg-white/70'
                  }`}
                >
                  <MessageCircle size={13} className={`flex-shrink-0 ${isActive ? 'text-orange-500' : 'text-stone-400'}`} />
                  <span className="flex-1 min-w-0 truncate text-[13px] text-stone-700">{s.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteChat(s.id); }}
                    aria-label="Delete chat"
                    className="flex-shrink-0 p-0.5 rounded text-stone-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
          {empty ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-11 h-11 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                <OrbitLogo size={24} />
              </div>
              <h2 className="text-[15px] font-semibold text-stone-800 mb-5">Ask anything, or just tell me what happened</h2>
              <div className="flex flex-col gap-1.5 w-full">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-[13px] text-stone-600 bg-stone-50 hover:bg-white hover:border-stone-300 border border-stone-200 rounded-lg px-3.5 py-2.5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((m, i) => (
                <MessageRow
                  key={i}
                  message={m}
                  byId={byId}
                  onConfirm={confirmAction}
                  onCancel={cancelAction}
                  onSaveDraft={(contactId, content) => saveDraft(contactId, { channel: 'manual', content })}
                  onMarkSent={(contactId, content) => markSent(contactId, { channel: 'manual', content })}
                />
              ))}

              {/* In-flight streaming turn */}
              {stream && (
                <div className="flex gap-2.5 justify-start chat-in">
                  <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <OrbitLogo size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {stream.phase === 'thinking' && !stream.text ? (
                      <div className="bg-stone-100 rounded-2xl rounded-bl-md px-3.5 py-3 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
                      </div>
                    ) : (
                      <div className="bg-stone-100 text-stone-700 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                        {stream.text}<span className="chat-caret" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 border-t border-stone-100 px-6 py-4">
          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="max-w-2xl mx-auto flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-full pl-4 pr-1.5 py-1.5 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400/20 transition-colors"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask, or tell me what happened…"
              className="flex-1 bg-transparent text-sm text-stone-800 placeholder-stone-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              aria-label="Send"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 transition active:scale-95"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message, byId, onConfirm, onCancel, onSaveDraft, onMarkSent,
}: {
  message: StoredMsg;
  byId: Map<string, Contact>;
  onConfirm: (messageId: string, actionId: string) => void;
  onCancel: (messageId: string, actionId: string) => void;
  onSaveDraft: (contactId: string, content: string) => void;
  onMarkSent: (contactId: string, content: string) => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end chat-in">
        <div className="max-w-[80%] bg-orange-500 text-white rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed inline-block whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 justify-start chat-in">
      <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <OrbitLogo size={16} />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {message.text.trim() && (
          <div className="bg-stone-100 text-stone-700 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm">
            <ChatMarkdown text={message.text} />
          </div>
        )}
        {message.contactIds && (
          <div className="space-y-1.5">
            {message.contactIds.map(id => byId.get(id)).filter(Boolean).map(c => (
              <ContactRef key={c!.id} contact={c!} />
            ))}
          </div>
        )}
        {message.actions?.map(a => (
          <ActionCard
            key={a.action.id}
            stored={a}
            onConfirm={() => onConfirm(message.id!, a.action.id)}
            onCancel={() => onCancel(message.id!, a.action.id)}
            onSaveDraft={onSaveDraft}
            onMarkSent={onMarkSent}
          />
        ))}
      </div>
    </div>
  );
}

function ActionCard({
  stored, onConfirm, onCancel, onSaveDraft, onMarkSent,
}: {
  stored: StoredAction;
  onConfirm: () => void;
  onCancel: () => void;
  onSaveDraft: (contactId: string, content: string) => void;
  onMarkSent: (contactId: string, content: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [draftSaved, setDraftSaved] = useState<null | 'saved' | 'sent'>(null);

  if (stored.status === 'confirmed') {
    return (
      <div className="chat-in rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
        <div className="flex items-center gap-2 text-[13px] font-medium text-emerald-800">
          <Check size={14} className="flex-shrink-0" />
          {stored.receipt ?? stored.summary}
        </div>
        {stored.draft && stored.draftContactId && (
          <div className="mt-2 rounded-lg bg-white border border-emerald-100 p-2.5">
            <p className="text-[13px] text-stone-700 whitespace-pre-wrap leading-relaxed">{stored.draft}</p>
            <div className="flex items-center gap-2 mt-2">
              {draftSaved ? (
                <span className="text-[12px] font-medium text-emerald-700">{draftSaved === 'sent' ? 'Marked sent ✓' : 'Saved as draft ✓'}</span>
              ) : (
                <>
                  <button
                    onClick={() => { onSaveDraft(stored.draftContactId!, stored.draft!); setDraftSaved('saved'); }}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 text-[12px] font-medium text-stone-600 hover:border-stone-300"
                  >
                    Save draft
                  </button>
                  <button
                    onClick={() => { onMarkSent(stored.draftContactId!, stored.draft!); setDraftSaved('sent'); }}
                    className="px-2.5 py-1 rounded-lg bg-orange-500 text-white text-[12px] font-semibold hover:bg-orange-600"
                  >
                    Mark sent
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stored.status === 'cancelled') {
    return <div className="chat-in text-[12px] text-stone-400 pl-1">Skipped · {stored.summary}</div>;
  }

  if (stored.status === 'failed') {
    return (
      <div className="chat-in rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-[13px] text-red-700">
        {stored.receipt ?? "That didn't work."}
      </div>
    );
  }

  // pending
  return (
    <div className="chat-in rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[13px] font-semibold text-stone-800">{stored.summary}</p>
      <div className="flex items-center gap-2 mt-2.5">
        <button
          disabled={running}
          onClick={() => { setRunning(true); onConfirm(); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[12px] font-semibold hover:bg-orange-600 disabled:opacity-60 transition active:scale-95"
        >
          {running ? <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Check size={13} />}
          Confirm
        </button>
        <button
          disabled={running}
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-[12px] font-medium text-stone-500 hover:text-stone-700 hover:border-stone-300 transition active:scale-95"
        >
          <X size={13} />
          Cancel
        </button>
      </div>
    </div>
  );
}
