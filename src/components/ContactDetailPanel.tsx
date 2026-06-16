'use client';

import { useState } from 'react';
import { Contact, Interaction, Status, columnConfig, getNextAction, followUpLabel, INTERACTION_LABEL, statusFromChange } from '@/lib/mockData';
import CompanyLogo from './CompanyLogo';
import MessageViewModal from './MessageViewModal';
import TemperatureInfo from './TemperatureInfo';
import StatusMenu from './StatusMenu';
import { useGoalsStore } from '@/lib/goalsStore';
import { formatDate } from '@/lib/utils';
import { X, Pencil, Star, Mail, Phone, Link2, ExternalLink } from 'lucide-react';

interface Props {
  /** The selected contact, or null when the panel is closed. */
  contact: Contact | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDraft: (contact: Contact) => void;
  onLogResponse: (contact: Contact) => void;
  onScheduleMeeting: (contact: Contact) => void;
  onMarkMet: (contact: Contact) => void;
  onMoveToLongTerm: (contact: Contact) => void;
  onMarkGhosted: (contact: Contact) => void;
  onSetFollowUp: (contact: Contact) => void;
  onChangeStatus: (id: string, status: Status) => void;
}

/** Interactions whose text can be opened in a read-only popup. */
const VIEWABLE_TYPES = new Set(['message_sent', 'message_drafted', 'response_logged']);

const TEMP_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

/** Statuses from which a contact can still be parked in Long-term. */
const LONG_TERM_FROM: Contact['status'][] = ['Response', 'Met', 'Ghosted'];

/** One unified action-button style — soft orange, used for every action. */
const ACTION_BTN =
  'inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-orange-600 text-[13px] font-semibold rounded-lg border border-orange-200 hover:bg-orange-50 transition active:scale-95';

/** Timeline node color per interaction type — one meaningful color each. */
const NODE_COLOR: Record<string, string> = {
  message_drafted: 'bg-orange-500',
  message_sent: 'bg-blue-500',
  follow_up_scheduled: 'bg-amber-500',
  response_logged: 'bg-emerald-500',
  meeting_scheduled: 'bg-indigo-500',
  meeting_completed: 'bg-teal-500',
  status_changed: 'bg-stone-400',
};

/** Interaction types whose free-text content is worth showing inline. */
const BODY_TYPES = new Set(['meeting_completed']);

/** The colored detail line (a scheduled date), or null. */
function timelineDetail(it: Interaction): { text: string; className: string } | null {
  if (it.type === 'meeting_scheduled' && it.dueAt) {
    return {
      text: new Date(it.dueAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      className: 'text-indigo-600',
    };
  }
  if (it.type === 'follow_up_scheduled' && it.dueAt) {
    return { text: `Due ${new Date(it.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, className: 'text-amber-600' };
  }
  return null;
}

export default function ContactDetailPanel({
  contact, onClose, onEdit, onDraft, onLogResponse,
  onScheduleMeeting, onMarkMet, onMoveToLongTerm, onMarkGhosted, onSetFollowUp, onChangeStatus,
}: Props) {
  // Hold the last contact while the panel slides closed so content doesn't
  // vanish mid-animation. Adjusting state during render (not in an effect) is
  // React's endorsed pattern for deriving from a changing prop.
  const [shown, setShown] = useState<Contact | null>(contact);
  if (contact && contact !== shown) setShown(contact);

  // A timeline message opened in the read-only viewer, or null.
  const [viewMessage, setViewMessage] = useState<Interaction | null>(null);

  // Goal membership is edited here (existing goals only — no free text).
  const { goals, addMember, removeMember } = useGoalsStore();

  const open = !!contact;
  const c = contact ?? shown;
  const cfg = c ? columnConfig[c.status] ?? { dot: 'bg-stone-400', bg: 'bg-stone-100', text: 'text-stone-600' } : null;
  const temp = c ? TEMP_LEVEL[c.warmth] ?? 1 : 0;
  const timeline = c ? [...c.interactions].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const followUp = c ? followUpLabel(c) : null;

  return (
    <>
    <div
      className={`flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${open ? 'w-[384px]' : 'w-0'}`}
      aria-hidden={!open}
    >
      <div className="w-[384px] h-full pl-3">
        <div className="h-full flex flex-col rounded-3xl bg-white border border-stone-200/70 shadow-xl shadow-stone-300/40 overflow-hidden">
          {c && cfg && (
            <>
              {/* Header */}
              <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-stone-100">
                <div className="flex items-start gap-3">
                  <CompanyLogo
                    company={c.company}
                    fallbackInitial={(c.company || c.name || '?').charAt(0).toUpperCase()}
                    fallbackColor={c.company ? 'bg-stone-100 text-stone-500' : c.avatarColor}
                    className="w-12 h-12 rounded-xl border border-stone-200 flex-shrink-0 p-1"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[17px] font-bold text-stone-900 leading-tight truncate">{c.name}</h2>
                    {[c.role, c.company].filter(Boolean).join(' · ') && (
                      <p className="text-[13px] text-stone-500 leading-tight truncate mt-0.5">
                        {[c.role, c.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(c.id)}
                      aria-label={`Edit ${c.name}`}
                      className="p-1.5 rounded-lg text-stone-400 hover:bg-orange-50 hover:text-orange-500 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close"
                      className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Status + temperature */}
                <div className="flex items-center gap-2 mt-3.5">
                  <StatusMenu status={c.status} onChange={(s) => onChangeStatus(c.id, s)} />
                  <span className="inline-flex items-center gap-0.5" title={`Temperature: ${c.warmth}`}>
                    {[1, 2, 3].map((i) => (
                      <Star key={i} size={13} className={i <= temp ? 'fill-orange-400 text-orange-400' : 'fill-stone-100 text-stone-200'} />
                    ))}
                  </span>
                  <TemperatureInfo />
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
                {/* Goals — membership in existing goals (no free text) */}
                <Section title="Goals">
                  {goals.length === 0 ? (
                    <p className="text-sm text-stone-400 italic">No goals yet — create one on the Insights page.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {goals.map((g) => {
                        const active = g.memberIds.includes(c.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => (active ? removeMember(g.id, c.id) : addMember(g.id, c.id))}
                            aria-pressed={active}
                            className={`px-2.5 py-1 rounded-full text-[13px] font-medium border transition-colors ${
                              active
                                ? 'bg-orange-500 border-orange-500 text-white'
                                : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-100'
                            }`}
                          >
                            {g.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Section>

                {/* Contact info */}
                <Section title="Contact">
                  <div className="space-y-1.5">
                    {c.email
                      ? <InfoLink icon={<Mail size={14} />} href={`mailto:${c.email}`} label={c.email} />
                      : <InfoEmpty icon={<Mail size={14} />} label="No email" />}
                    {c.linkedinUrl
                      ? <InfoLink icon={<Link2 size={14} />} href={c.linkedinUrl} label="LinkedIn profile" external />
                      : <InfoEmpty icon={<Link2 size={14} />} label="No LinkedIn" />}
                    {c.phone
                      ? <InfoLink icon={<Phone size={14} />} href={`tel:${c.phone}`} label={c.phone} />
                      : <InfoEmpty icon={<Phone size={14} />} label="No phone" />}
                  </div>
                </Section>

                {/* Next action */}
                <Section title="Next action" accent>
                  <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3.5">
                    <p className="text-sm text-stone-700 leading-relaxed">{getNextAction(c)}</p>
                    {followUp && <p className="text-[12px] font-medium text-orange-600 mt-1.5">{followUp}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/* Pending is a waiting state — no Draft button there. */}
                      {c.status !== 'Pending' && (
                        <button type="button" onClick={() => onDraft(c)} className={ACTION_BTN}>
                          {c.status === 'Response' ? 'Draft reply' : 'Draft message'}
                        </button>
                      )}
                      {c.status === 'Pending' && (
                        <button type="button" onClick={() => onLogResponse(c)} className={ACTION_BTN}>Log response</button>
                      )}
                      {(c.status === 'Response' || c.status === 'Long-term') && (
                        <button type="button" onClick={() => onScheduleMeeting(c)} className={ACTION_BTN}>Schedule meeting</button>
                      )}
                      {c.status === 'Meeting Scheduled' && (
                        <button type="button" onClick={() => onMarkMet(c)} className={ACTION_BTN}>Mark as met</button>
                      )}
                      {c.status === 'Pending' && (
                        <button type="button" onClick={() => onMarkGhosted(c)} className={ACTION_BTN}>Mark ghosted</button>
                      )}
                      {LONG_TERM_FROM.includes(c.status) && (
                        <button type="button" onClick={() => onMoveToLongTerm(c)} className={ACTION_BTN}>Move to long-term</button>
                      )}
                      {/* Available on every status — set when to send/follow up next. */}
                      <button type="button" onClick={() => onSetFollowUp(c)} className={ACTION_BTN}>
                        {c.status === 'Send' ? 'Schedule send' : 'Set follow-up'}
                      </button>
                    </div>
                  </div>
                </Section>

                {/* Timeline — a rail with a colored node per action type */}
                <Section title="Timeline">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-stone-400 italic">No interactions logged yet.</p>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-stone-200" aria-hidden />
                      <ol className="space-y-3.5">
                        {timeline.map((it) => {
                          const detail = timelineDetail(it);
                          const showBody = BODY_TYPES.has(it.type) && it.content;
                          const isResponse = it.type === 'response_logged';
                          const showView = VIEWABLE_TYPES.has(it.type) && !!it.content;
                          // For a generic status move, show what it became ("Moved to
                          // Pending"); otherwise the event's label. Never "Status changed".
                          const label = it.type === 'status_changed' && it.content
                            ? it.content
                            : INTERACTION_LABEL[it.type] ?? it.type;
                          // Status-change nodes take the destination status's color (e.g. green
                          // for "Moved to Response"); everything else keeps its fixed color.
                          const nodeColor = it.type === 'status_changed'
                            ? columnConfig[statusFromChange(it.content) ?? '']?.dot ?? 'bg-stone-400'
                            : NODE_COLOR[it.type] ?? 'bg-stone-300';
                          return (
                            <li key={it.id} className="relative pl-5">
                              <span className={`absolute left-[1px] top-[5px] w-2.5 h-2.5 rounded-full ring-2 ring-white ${nodeColor}`} />
                              <div className="flex items-baseline gap-2">
                                <span className="text-[12.5px] font-semibold text-stone-700">{label}</span>
                                <span className="text-[11px] text-stone-400 ml-auto flex-shrink-0">{formatDate(it.date)}</span>
                              </div>
                              {detail && <div className={`text-[11.5px] font-medium mt-0.5 ${detail.className}`}>{detail.text}</div>}
                              {showBody && <p className="text-[12.5px] text-stone-600 leading-relaxed mt-0.5 whitespace-pre-line">{it.content}</p>}
                              {showView && (
                                <button
                                  type="button"
                                  onClick={() => setViewMessage(it)}
                                  className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                                >
                                  {isResponse ? 'View response' : 'View message'}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </Section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>

    {viewMessage && (
      <MessageViewModal
        title={(viewMessage.type === 'response_logged' ? `Response from ${c?.name ?? ''}` : `Message to ${c?.name ?? ''}`).trim()}
        channel={viewMessage.channel}
        content={viewMessage.content}
        onClose={() => setViewMessage(null)}
      />
    )}
    </>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section>
      <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${accent ? 'text-orange-500' : 'text-stone-400'}`}>{title}</h3>
      {children}
    </section>
  );
}

function InfoLink({ icon, href, label, external }: { icon: React.ReactNode; href: string; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-2 text-sm text-stone-600 hover:text-orange-600 transition-colors group"
    >
      <span className="text-stone-400 group-hover:text-orange-500">{icon}</span>
      <span className="truncate">{label}</span>
      {external && <ExternalLink size={12} className="text-stone-300 group-hover:text-orange-400 flex-shrink-0" />}
    </a>
  );
}

function InfoEmpty({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-stone-300">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
