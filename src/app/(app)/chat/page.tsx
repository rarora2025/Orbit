'use client';

import { useState, useRef, useEffect } from 'react';
import { useCRMStore } from '@/lib/store';
import { useChatStore } from '@/lib/chatStore';
import { Contact, columnConfig } from '@/lib/mockData';
import { Send, Star, Plus, MessageCircle, Trash2 } from 'lucide-react';
import OrbitLogo from '@/components/OrbitLogo';
import CompanyLogo from '@/components/CompanyLogo';

type Reply = { text: string; contacts?: Contact[]; followups?: string[] };

const TEMP_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

const SUGGESTIONS = [
  'Who in my network works in prediction markets?',
  'How are my contacts related to my career goals?',
  'Which relationships should I prioritize right now?',
];

function dedupe(contacts: Contact[]): Contact[] {
  const seen = new Set<string>();
  return contacts.filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

// Prototype responder — no model wired up yet. Pulls from the real contact list
// so answers feel grounded; swap this for an API call when the backend is ready.
function buildReply(question: string, contacts: Contact[]): Reply {
  const q = question.toLowerCase();

  if (!contacts.length) {
    return { text: "Your network is empty right now — add a few people on the Dashboard and I can start connecting the dots." };
  }

  // Mention of a specific person or company
  const mentioned = contacts.filter(c => {
    const first = c.name.toLowerCase().split(' ')[0];
    return (first.length > 2 && q.includes(first)) || (c.company && q.includes(c.company.toLowerCase()));
  });
  if (mentioned.length) {
    const c = mentioned[0];
    const peers = contacts.filter(o => o.id !== c.id && o.tags.some(t => c.tags.includes(t)));
    const overlap = c.tags.filter(t => peers.some(p => p.tags.includes(t))).slice(0, 3);
    const text = peers.length
      ? `${c.name} is in your "${c.status}" lane with ${c.warmth.toLowerCase()} temperature. They overlap with others through ${overlap.join(', ')}:`
      : `${c.name} is in your "${c.status}" lane. I don't see strong overlap with the rest of your network yet — a good candidate for a warm intro.`;
    return {
      text,
      contacts: dedupe([c, ...peers]).slice(0, 4),
      followups: ['Who should I prioritize right now?', 'How do they relate to my career goals?'],
    };
  }

  // Topic / tag based
  const tagCount = new Map<string, Contact[]>();
  contacts.forEach(c => c.tags.forEach(t => tagCount.set(t, [...(tagCount.get(t) ?? []), c])));
  const matchedTag = [...tagCount.keys()].find(t => q.includes(t.toLowerCase()));
  if (matchedTag) {
    const people = tagCount.get(matchedTag)!;
    return {
      text: `${people.length} ${people.length === 1 ? 'person works' : 'people work'} on ${matchedTag}:`,
      contacts: people,
      followups: ['Who should I prioritize here?', 'How does this map to my career goals?'],
    };
  }

  // Prioritisation
  if (/priorit|focus|who.*reach|next/.test(q)) {
    const warm = contacts.filter(c => c.warmth === 'High');
    const stale = contacts.filter(c => c.status === 'Pending');
    return {
      text: `I'd focus on your warmest relationships and the ${stale.length} people waiting on a reply in "Pending". Here's where to start:`,
      contacts: dedupe([...warm, ...stale]).slice(0, 5),
      followups: ['How do these relate to my career goals?', 'Who works in prediction markets?'],
    };
  }

  // Career goals
  if (/career|goal|draftiq|sports|betting|fantasy/.test(q)) {
    const relevant = contacts.filter(c => c.tags.some(t => /sport|fantasy|betting|prediction|operator/i.test(t)));
    return relevant.length
      ? {
          text: `For a sports/fantasy direction, these are your most relevant people — that cluster is where your network is strongest for that goal:`,
          contacts: relevant.slice(0, 5),
          followups: ['Who should I prioritize right now?', "What's missing from this cluster?"],
        }
      : {
          text: `I don't see many contacts tagged toward sports/fantasy yet — that's a gap worth filling if it's a career focus.`,
          followups: ['Who should I prioritize right now?'],
        };
  }

  // Default: network summary
  const topTags = [...tagCount.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
  return {
    text: `You have ${contacts.length} people in your network. The strongest themes are ${topTags.map(([t, p]) => `${t} (${p.length})`).join(', ')}. Ask me how any two of them connect, or who to prioritise.`,
    contacts: topTags[0] ? topTags[0][1].slice(0, 3) : undefined,
    followups: ['Who should I prioritize right now?', 'How do my contacts relate to my career goals?'],
  };
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

export default function ChatPage() {
  const { contacts, loaded } = useCRMStore();
  const { sessions, activeId, newChat, selectChat, deleteChat, addUserMessage, addAssistantMessage } = useChatStore();
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstQuestionSent = useRef(false);

  const active = sessions.find(s => s.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const byId = new Map(contacts.map(c => [c.id, c]));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, thinking]);

  function send(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    const sessionId = addUserMessage(q);
    setInput('');
    setThinking(true);
    setTimeout(() => {
      const reply = buildReply(q, contacts);
      addAssistantMessage(sessionId, {
        role: 'assistant',
        text: reply.text,
        contactIds: reply.contacts?.map(c => c.id),
        followups: reply.followups,
      });
      setThinking(false);
    }, 700);
  }

  // A question chosen at the end of onboarding is stashed in sessionStorage and
  // auto-sent here, once contacts have loaded so the first answer is grounded.
  useEffect(() => {
    if (!loaded || firstQuestionSent.current) return;
    let q: string | null = null;
    try { q = sessionStorage.getItem('orbit_onboarding_q'); } catch { /* ignore */ }
    if (!q) return;
    firstQuestionSent.current = true;
    try { sessionStorage.removeItem('orbit_onboarding_q'); } catch { /* ignore */ }
    send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const empty = messages.length === 0;
  const lastAssistant = !thinking && messages.length > 0 && messages[messages.length - 1].role === 'assistant'
    ? (messages[messages.length - 1] as Extract<typeof messages[number], { role: 'assistant' }>)
    : null;

  return (
    <div className="flex-1 flex min-h-0 rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40 overflow-hidden">
      {/* History sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-stone-100 bg-stone-50/50">
        <div className="p-3 flex-shrink-0">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500 text-white text-[13px] font-semibold hover:bg-orange-600 transition active:scale-[0.98] shadow-sm shadow-orange-500/30"
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
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
                <OrbitLogo size={26} />
              </div>
              <h2 className="text-base font-semibold text-stone-800">Ask anything about your network</h2>
              <p className="text-sm text-stone-400 mt-1 mb-5">How people connect, who to prioritise, or how they map to your goals.</p>
              <div className="flex flex-col gap-2 w-full">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-sm text-stone-600 bg-stone-50 hover:bg-orange-50 hover:text-orange-700 border border-stone-200 rounded-xl px-3.5 py-2.5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <OrbitLogo size={16} />
                    </div>
                  )}
                  <div className={m.role === 'user' ? 'max-w-[80%]' : 'flex-1 min-w-0 space-y-2'}>
                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-orange-500 text-white rounded-br-md inline-block'
                        : 'bg-stone-100 text-stone-700 rounded-bl-md'
                    }`}>
                      {m.text}
                    </div>
                    {m.role === 'assistant' && m.contactIds && (
                      <div className="space-y-1.5">
                        {m.contactIds.map(id => byId.get(id)).filter(Boolean).map(c => (
                          <ContactRef key={c!.id} contact={c!} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <OrbitLogo size={16} />
                  </div>
                  <div className="bg-stone-100 rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
                  </div>
                </div>
              )}

              {/* Follow-up suggestions after the latest reply */}
              {lastAssistant?.followups && lastAssistant.followups.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-9 pt-1">
                  {lastAssistant.followups.map(f => (
                    <button
                      key={f}
                      onClick={() => send(f)}
                      className="text-[13px] text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-full px-3 py-1.5 transition-colors"
                    >
                      {f}
                    </button>
                  ))}
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
              placeholder="Ask about your network…"
              className="flex-1 bg-transparent text-sm text-stone-800 placeholder-stone-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
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
