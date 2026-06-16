'use server';

import type { Contact, Status, Warmth } from '../mockData';
import type { ProposedAction } from './tools';
import { resolveContact } from './resolveContact';
import {
  listContacts, addContact, changeStatusLogged, markMet, logResponse,
  markMessageSent, setFollowUp, scheduleMeeting,
} from '../contacts.actions';
import { listGoals, addGoal, addGoalMember, generateGoalImage } from '../goals.actions';
import { generateDraft } from '../ai.actions';
import type { MoveKind } from '../nextMoves';

export type ActionResult =
  | { ok: true; receipt: string; draft?: string; draftContactId?: string }
  | { ok: false; error: string };

const AVATAR_CLASSES = [
  'bg-indigo-500 text-white', 'bg-pink-500 text-white', 'bg-amber-500 text-white',
  'bg-emerald-500 text-white', 'bg-blue-500 text-white', 'bg-violet-500 text-white',
];

function buildContact(args: { name: string; company?: string; role?: string; email?: string; phone?: string; linkedinUrl?: string; warmth?: Warmth }, index: number): Contact {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    position: 0,
    name: args.name,
    company: args.company ?? '',
    role: args.role ?? '',
    linkedinUrl: args.linkedinUrl ?? '',
    email: args.email ?? '',
    phone: args.phone ?? '',
    notes: '',
    status: 'Send' as Status,
    score: args.warmth === 'High' ? 85 : args.warmth === 'Low' ? 45 : 62,
    warmth: args.warmth ?? 'Medium',
    avatarColor: AVATAR_CLASSES[index % AVATAR_CLASSES.length],
    tags: [],
    lastContacted: now.toISOString(),
    nextFollowUpAt: now.toISOString(),
    nextAction: `Send first message to ${args.name}`,
    aiSummary: '',
    outreachAngle: '',
    suggestedMessage: '',
    interactions: [],
  };
}

/**
 * Run a single confirmed action by delegating to the existing contacts/goals
 * actions. Contact-targeted actions resolve the name against the live network and
 * return a friendly error when it can't be matched. Returns a short receipt for
 * the chat to display.
 */
export async function executeChatAction(action: ProposedAction): Promise<ActionResult> {
  try {
    // create_contact / create_goal don't need an existing contact.
    if (action.type === 'create_contact') {
      const existing = await listContacts();
      await addContact(buildContact(action.args, existing.length));
      return { ok: true, receipt: `Added ${action.args.name}${action.args.company ? ` at ${action.args.company}` : ''}` };
    }
    if (action.type === 'create_goal') {
      const goal = await addGoal({ title: action.args.title });
      void generateGoalImage(goal.id, goal.title).catch(() => {});
      return { ok: true, receipt: `Created goal “${goal.title}”` };
    }

    const contacts = await listContacts();

    if (action.type === 'add_contact_to_goal') {
      const r = resolveContact(action.args.contactName, contacts);
      if ('error' in r) return { ok: false, error: r.error };
      const goals = await listGoals();
      const goal = goals.find((g) => g.title.toLowerCase() === action.args.goalTitle.toLowerCase())
        ?? goals.find((g) => g.title.toLowerCase().includes(action.args.goalTitle.toLowerCase()));
      if (!goal) return { ok: false, error: `I couldn't find a goal called “${action.args.goalTitle}”.` };
      await addGoalMember(goal.id, r.contact.id);
      return { ok: true, receipt: `Added ${r.contact.name} to “${goal.title}”` };
    }

    // Remaining actions all target one existing contact.
    const r = resolveContact(action.args.contactName, contacts);
    if ('error' in r) return { ok: false, error: r.error };
    const c = r.contact;

    switch (action.type) {
      case 'set_status':
        await changeStatusLogged(c.id, action.args.status, `Moved to ${action.args.status}`);
        return { ok: true, receipt: `${c.name} → ${action.args.status}` };
      case 'log_meeting':
        await markMet(c.id, { notes: action.args.notes ?? '', followUpAt: action.args.followUpDate });
        return { ok: true, receipt: `Logged meeting with ${c.name}${action.args.followUpDate ? ` · follow up ${action.args.followUpDate}` : ''}` };
      case 'log_response':
        await logResponse(c.id, { content: action.args.summary, nextStep: action.args.nextStep });
        return { ok: true, receipt: `Logged ${c.name}'s reply` };
      case 'mark_sent':
        await markMessageSent(c.id, { channel: 'manual', content: '' });
        return { ok: true, receipt: `Marked message sent to ${c.name}` };
      case 'set_follow_up':
        await setFollowUp(c.id, { date: action.args.date, reason: action.args.reason });
        return { ok: true, receipt: `Follow up with ${c.name} on ${action.args.date}` };
      case 'schedule_meeting':
        await scheduleMeeting(c.id, { date: action.args.date, time: action.args.time ?? '', notes: action.args.notes ?? '' });
        return { ok: true, receipt: `Meeting with ${c.name} on ${action.args.date}` };
      case 'draft_message': {
        const kind = (['outreach', 'follow-up', 'reply'].includes(action.args.kind ?? '') ? action.args.kind : 'message') as MoveKind | 'message';
        const draft = await generateDraft(c.id, kind, action.args.tone as never);
        return { ok: true, receipt: `Drafted a message to ${c.name}`, draft, draftContactId: c.id };
      }
      default:
        return { ok: false, error: 'Unknown action.' };
    }
  } catch (err) {
    console.error('executeChatAction failed', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong running that.' };
  }
}
