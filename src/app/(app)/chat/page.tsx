'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCRMStore } from '@/lib/store';
import { useChatStore } from '@/lib/chatStore';
import { useGoalsStore } from '@/lib/goalsStore';
import { Contact, columnConfig } from '@/lib/mockData';
import { Send, Star, Plus, MessageCircle, Trash2, UserPlus, Target } from 'lucide-react';
import OrbitLogo from '@/components/OrbitLogo';
import CompanyLogo from '@/components/CompanyLogo';
import ContactModal from '@/components/ContactModal';
import NewGoalModal from '@/components/NewGoalModal';
import { CHAT_SUGGESTIONS as SUGGESTIONS } from '@/lib/chatSuggestions';

// A thing the assistant offers to create from the conversation.
type Proposal =
  | { kind: 'contact'; name: string; company?: string }
  | { kind: 'goal'; title: string };

type Reply = {
  text: string;
  contacts?: Contact[];
  followups?: string[];
  proposal?: Proposal;
};

const TEMP_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

// Neutral, industry-agnostic follow-ups (the old ones assumed prediction markets).
const FOLLOWUPS = [
  'Who should I reconnect with?',
  'Who can help with my goals?',
  'Which relationships need attention?',
];

function dedupe(contacts: Contact[]): Contact[] {
  const seen = new Set<string>();
  return contacts.filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

function clean(s: string): string {
  return s.trim().replace(/^["']|["'.,!?]+$/g, '').trim();
}

// "Jane Doe at Acme" / "Jane from Acme" / "Jane, Acme" -> { name, company }.
function parsePerson(phrase: string): { name: string; company?: string } {
  const m = phrase.match(/^(.+?)\s+(?:at|from|@|,|with)\s+(.+)$/i);
  if (m) return { name: clean(m[1]), company: clean(m[2]) };
  return { name: clean(phrase) };
}

// Detect "create a goal / add goal: X" and "add Jane at Acme" style asks so the
// assistant can offer to actually create the person or goal.
function detectProposal(raw: string): Proposal | null {
  const qt = raw.trim();
  const goalM =
    qt.match(/^(?:add|create|new|set(?:\s*up)?)\s+(?:a\s+)?goal\s*:?\s*(.+)$/i) ||
    qt.match(/^goal\s*:\s*(.+)$/i);
  if (goalM) {
    const title = clean(goalM[1]);
    if (title) return { kind: 'goal', title };
  }
  const explicit = qt.match(/^(?:add|create|new)\s+(?:person|contact|connection)\s*:?\s*(.+)$/i);
  const named = qt.match(/^add\s+([A-Z].+)$/);
  const phrase = explicit?.[1] ?? named?.[1];
  if (phrase) {
    const { name, company } = parsePerson(phrase);
    if (name) return { kind: 'contact', name, company };
  }
  return null;
}

// Prototype responder — no model wired up yet. Pulls from the real contact list
// so answers feel grounded; swap this for an API call when the backend is ready.
function buildReply(question: string, contacts: Contact[]): Reply {
  const q = question.toLowerCase();

  // Let people add a person or goal straight from the chat.
  const proposal = detectProposal(question);
  if (proposal) {
    return proposal.kind === 'goal'
      ? { text: `Want me to create the goal “${proposal.title}”? I’ll generate a photo for it too.`, proposal }
      : {
          text: `I can add ${proposal.name}${proposal.company ? ` at ${proposal.company}` : ''} to your network. Quick check on the details:`,
          proposal,
        };
  }

  if (!contacts.length) {
    return {
      text: "Your network is empty so far. Tell me about someone you want to track — try “add Jane Doe at Acme” — or what you’re working toward, and I’ll help you build it out.",
      followups: ['Add my first person', 'Create a goal'],
    };
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
      ? `${c.name} is in your “${c.status}” lane with ${c.warmth.toLowerCase()} temperature. They overlap with others through ${overlap.join(', ')}:`
      : `${c.name} is in your “${c.status}” lane. I don’t see strong overlap with the rest of your network yet — a good candidate for a warm intro.`;
    return { text, contacts: dedupe([c, ...peers]).slice(0, 4), followups: FOLLOWUPS };
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
      followups: FOLLOWUPS,
    };
  }

  // Prioritisation / reconnect / attention
  if (/priorit|focus|who.*reach|reconnect|cold|attention|catch ?up|next/.test(q)) {
    const warm = contacts.filter(c => c.warmth === 'High');
    const stale = contacts.filter(c => c.status === 'Pending');
    return {
      text: `I’d start with your warmest relationships${stale.length ? ` and the ${stale.length} waiting on a reply in “Pending”` : ''}. Here’s where to focus:`,
      contacts: dedupe([...warm, ...stale]).slice(0, 5),
      followups: FOLLOWUPS,
    };
  }

  // Goals / career
  if (/career|goal/.test(q)) {
    const withGoal = contacts.filter(c => c.goal);
    const picks = (withGoal.length ? withGoal : contacts.filter(c => c.warmth !== 'Low')).slice(0, 5);
    return {
      text: withGoal.length
        ? 'These people map most directly to what you’re working toward:'
        : 'You haven’t tied people to goals yet — based on temperature, these are the ones I’d lean on. Tell me a goal and I’ll line up who fits.',
      contacts: picks.length ? picks : undefined,
      followups: FOLLOWUPS,
    };
  }

  // Small network → probe instead of a thin summary
  if (contacts.length < 3) {
    return {
      text: `You’ve got ${contacts.length} ${contacts.length === 1 ? 'person' : 'people'} so far. What are you trying to do right now — find a job, fundraise, hire? Tell me and I’ll suggest who to reach out to, or add a few more and I’ll map the connections.`,
      contacts,
      followups: ['Add another person', 'Create a goal'],
    };
  }

  // Default: network summary
  const topTags = [...tagCount.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
  return {
    text: `You have ${contacts.length} people in your network. The strongest themes are ${topTags.map(([t, p]) => `${t} (${p.length})`).join(', ')}. Ask how any two connect, or who to prioritise.`,
    contacts: topTags[0] ? topTags[0][1].slice(0, 3) : undefined,
    followups: FOLLOWUPS,
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

// Guards the onboarding handoff against React's dev double-mount / re-renders so
// the first question is sent exactly once.
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
  const { contacts, loaded, addContact } = useCRMStore();
  const addGoal = useGoalsStore(s => s.addGoal);
  const { sessions, activeId, newChat, selectChat, deleteChat, addUserMessage, addAssistantMessage } = useChatStore();
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [contactModal, setContactModal] = useState<{ name?: string; company?: string } | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = sessions.find(s => s.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const byId = new Map(contacts.map(c => [c.id, c]));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, thinking, proposal]);

  function note(text: string) {
    // Drop a short assistant line into the active conversation (e.g. confirmations).
    if (activeId) addAssistantMessage(activeId, { role: 'assistant', text });
  }

  function send(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    const sessionId = addUserMessage(q);
    setInput('');
    setProposal(null);
    setThinking(true);
    setTimeout(() => {
      const reply = buildReply(q, contacts);
      addAssistantMessage(sessionId, {
        role: 'assistant',
        text: reply.text,
        contactIds: reply.contacts?.map(c => c.id),
        followups: reply.followups,
      });
      setProposal(reply.proposal ?? null);
      setThinking(false);
    }, 650);
  }

  // The question picked at the end of onboarding arrives as ?q=… — send it once
  // contacts have loaded (so the answer is grounded), then strip it from the URL
  // so the conversation reads as one clean thread (no flash of the empty state).
  useEffect(() => {
    if (!handoffQ || !loaded) return;
    if (consumedHandoffQ !== handoffQ) {
      consumedHandoffQ = handoffQ;
      const q = handoffQ;
      // Defer out of the effect body (runs before paint, so no empty-state flash).
      queueMicrotask(() => send(q));
    }
    router.replace('/chat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffQ, loaded]);

  async function handleAddContact(c: Contact) {
    await addContact(c);
    setContactModal(null);
    setProposal(null);
    note(`Added ${c.name}${c.company ? ` at ${c.company}` : ''} to your network.`);
  }
  function handleCreateGoal(title: string) {
    void addGoal(title);
    setGoalModalOpen(false);
    setProposal(null);
    note(`Created the goal “${title}” — generating a photo for it now.`);
  }

  // While the onboarding question is still in flight, suppress the empty state.
  const empty = messages.length === 0 && !handoffQ;
  const showThinking = thinking || (!!handoffQ && messages.length === 0);
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
              <h2 className="text-[15px] font-semibold text-stone-800">Ask anything about your network</h2>
              <p className="text-[13px] text-stone-400 mt-1 mb-5">Who to reach out to, how people connect, or add someone new.</p>
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
              <div className="flex items-center gap-2 mt-4">
                <QuickAction icon={<UserPlus size={14} />} label="Add person" onClick={() => setContactModal({})} />
                <QuickAction icon={<Target size={14} />} label="New goal" onClick={() => setGoalModalOpen(true)} />
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
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
              {showThinking && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <OrbitLogo size={16} />
                  </div>
                  <div className="bg-stone-100 rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
                  </div>
                </div>
              )}

              {/* Inline action: create the person/goal the assistant proposed */}
              {proposal && !thinking && (
                <div className="pl-9">
                  {proposal.kind === 'contact' ? (
                    <button
                      onClick={() => setContactModal({ name: proposal.name, company: proposal.company })}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500 text-white text-[13px] font-semibold hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30"
                    >
                      <UserPlus size={14} />
                      Add {proposal.name}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCreateGoal(proposal.title)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500 text-white text-[13px] font-semibold hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30"
                    >
                      <Target size={14} />
                      Create “{proposal.title}”
                    </button>
                  )}
                </div>
              )}

              {/* Follow-up suggestions after the latest reply */}
              {lastAssistant?.followups && lastAssistant.followups.length > 0 && !proposal && (
                <div className="flex flex-wrap gap-2 pl-9 pt-1">
                  {lastAssistant.followups.map(f => (
                    <button
                      key={f}
                      onClick={() => {
                        if (f === 'Add my first person' || f === 'Add another person') return setContactModal({});
                        if (f === 'Create a goal') return setGoalModalOpen(true);
                        send(f);
                      }}
                      className="text-[13px] text-stone-600 bg-white hover:border-orange-300 hover:text-orange-600 border border-stone-200 rounded-full px-3 py-1.5 transition-colors"
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
            className="max-w-2xl mx-auto flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-full pl-2 pr-1.5 py-1.5 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400/20 transition-colors"
          >
            <button
              type="button"
              onClick={() => setContactModal({})}
              aria-label="Add person"
              title="Add person"
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-orange-600 hover:bg-white transition-colors"
            >
              <UserPlus size={16} />
            </button>
            <button
              type="button"
              onClick={() => setGoalModalOpen(true)}
              aria-label="New goal"
              title="New goal"
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-orange-600 hover:bg-white transition-colors"
            >
              <Target size={16} />
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask, or add a person…"
              className="flex-1 bg-transparent text-sm text-stone-800 placeholder-stone-400 focus:outline-none px-1"
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

      {contactModal && (
        <ContactModal
          prefill={contactModal}
          onClose={() => setContactModal(null)}
          onAdd={handleAddContact}
        />
      )}
      {goalModalOpen && (
        <NewGoalModal onClose={() => setGoalModalOpen(false)} onCreate={handleCreateGoal} />
      )}
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-200 text-[13px] font-medium text-stone-600 hover:border-orange-300 hover:text-orange-600 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}
