'use client';

import { useState } from 'react';
import { Contact, Interaction, columnConfig, getNextAction, followUpLabel, INTERACTION_LABEL } from '@/lib/mockData';
import CompanyLogo from './CompanyLogo';
import { formatDate } from '@/lib/utils';
import { X, Pencil, Star, Mail, Link2, ExternalLink } from 'lucide-react';

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
}

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
  note_added: 'bg-purple-500',
  status_changed: 'bg-stone-400',
};

/** Interaction types whose free-text content is worth showing (notes are the point). */
const BODY_TYPES = new Set(['note_added', 'meeting_completed']);

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
  onScheduleMeeting, onMarkMet, onMoveToLongTerm, onMarkGhosted,
}: Props) {
  // Hold the last contact while the panel slides closed so content doesn't
  // vanish mid-animation. Adjusting state during render (not in an effect) is
  // React's endorsed pattern for deriving from a changing prop.
  const [shown, setShown] = useState<Contact | null>(contact);
  if (contact && contact !== shown) setShown(contact);

  const open = !!contact;
  const c = contact ?? shown;
  const cfg = c ? columnConfig[c.status] ?? { dot: 'bg-stone-400', bg: 'bg-stone-100', text: 'text-stone-600' } : null;
  const temp = c ? TEMP_LEVEL[c.warmth] ?? 1 : 0;
  const timeline = c ? [...c.interactions].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const followUp = c ? followUpLabel(c) : null;

  return (
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
                  <span className={`inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 ${cfg.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    <span className={`text-[12px] font-semibold ${cfg.text}`}>{c.status}</span>
                  </span>
                  <span className="inline-flex items-center gap-0.5" title={`Temperature: ${c.warmth}`}>
                    {[1, 2, 3].map((i) => (
                      <Star key={i} size={13} className={i <= temp ? 'fill-orange-400 text-orange-400' : 'fill-stone-100 text-stone-200'} />
                    ))}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
                {/* Goals */}
                <Section title="Goals">
                  {c.goal
                    ? <p className="text-sm text-stone-700 leading-relaxed">{c.goal}</p>
                    : <p className="text-sm text-stone-400 italic">Not set — add what you want from this person.</p>}
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
                          return (
                            <li key={it.id} className="relative pl-5">
                              <span className={`absolute left-[1px] top-[5px] w-2.5 h-2.5 rounded-full ring-2 ring-white ${NODE_COLOR[it.type] ?? 'bg-stone-300'}`} />
                              <div className="flex items-baseline gap-2">
                                <span className="text-[12.5px] font-semibold text-stone-700">{INTERACTION_LABEL[it.type] ?? it.type}</span>
                                <span className="text-[11px] text-stone-400 ml-auto flex-shrink-0">{formatDate(it.date)}</span>
                              </div>
                              {detail && <div className={`text-[11.5px] font-medium mt-0.5 ${detail.className}`}>{detail.text}</div>}
                              {showBody && <p className="text-[12.5px] text-stone-600 leading-relaxed mt-0.5 whitespace-pre-line">{it.content}</p>}
                              {it.nextStep && (
                                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[11px] font-medium text-orange-600">
                                  Next: {it.nextStep}
                                </span>
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
