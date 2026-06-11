'use client';

import { useState } from 'react';
import { Contact, columnConfig, getNextAction, followUpLabel, INTERACTION_LABEL } from '@/lib/mockData';
import CompanyLogo from './CompanyLogo';
import { formatDate } from '@/lib/utils';
import { X, Pencil, Star, Mail, Link2, ExternalLink, Clock } from 'lucide-react';

interface Props {
  /** The selected contact, or null when the panel is closed. */
  contact: Contact | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDraft: (contact: Contact) => void;
}

const TEMP_LEVEL: Record<Contact['warmth'], number> = { Low: 1, Medium: 2, High: 3 };

export default function ContactDetailPanel({ contact, onClose, onEdit, onDraft }: Props) {
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

  function draftNextAction() {
    if (c) onDraft(c);
  }

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
                  {c.relationshipGoal
                    ? <p className="text-sm text-stone-700 leading-relaxed">{c.relationshipGoal}</p>
                    : <p className="text-sm text-stone-400 italic">Not set — add why this person matters.</p>}
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

                {/* AI next action */}
                <Section title="Next action" accent>
                  <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3.5">
                    <p className="text-sm text-stone-700 leading-relaxed">
                      {getNextAction(c)}
                    </p>
                    {followUp && (
                      <p className="text-[12px] font-medium text-orange-600 mt-1.5">{followUp}</p>
                    )}
                    <button
                      type="button"
                      onClick={draftNextAction}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-[13px] font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm shadow-orange-500/30"
                    >
                      Draft message
                    </button>
                  </div>
                </Section>

                {/* Timeline */}
                <Section title="Timeline">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-stone-400 italic">No interactions logged yet.</p>
                  ) : (
                    <ol className="space-y-3">
                      {timeline.map((it) => (
                        <li key={it.id} className="flex gap-3">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <span className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center">
                              <Clock size={13} className="text-stone-400" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-semibold text-stone-700">{INTERACTION_LABEL[it.type] ?? it.type}</span>
                              <span className="text-[11px] text-stone-400">{formatDate(it.date)}</span>
                            </div>
                            <p className="text-[13px] text-stone-600 leading-relaxed mt-0.5">{it.content}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
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
