import type { Status, Warmth } from '../mockData';

// Every tool the model can call is a *proposal* — it never mutates data directly.
// The client renders it as a confirm card; executeChatAction runs it on confirm.
export type ProposedAction =
  | { id: string; type: 'create_contact'; args: { name: string; company?: string; role?: string; email?: string; phone?: string; linkedinUrl?: string; warmth?: Warmth } }
  | { id: string; type: 'create_goal'; args: { title: string } }
  | { id: string; type: 'add_contact_to_goal'; args: { contactName: string; goalTitle: string } }
  | { id: string; type: 'set_status'; args: { contactName: string; status: Status } }
  | { id: string; type: 'log_meeting'; args: { contactName: string; notes?: string; followUpDate?: string } }
  | { id: string; type: 'log_response'; args: { contactName: string; summary: string; nextStep?: string } }
  | { id: string; type: 'mark_sent'; args: { contactName: string } }
  | { id: string; type: 'set_follow_up'; args: { contactName: string; date: string; reason?: string } }
  | { id: string; type: 'schedule_meeting'; args: { contactName: string; date: string; time?: string; notes?: string } }
  | { id: string; type: 'draft_message'; args: { contactName: string; kind?: string; tone?: string } };

export type ActionType = ProposedAction['type'];

/** Events streamed from /api/chat as newline-delimited JSON. */
export type ChatStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'proposals'; proposals: ProposedAction[] }
  | { type: 'error'; message: string }
  | { type: 'done' };

const STATUSES: Status[] = ['Send', 'Pending', 'Response', 'Ghosted', 'Meeting Scheduled', 'Met', 'Long-term'];

interface ChatTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

const str = (description: string) => ({ type: 'string', description });

/** OpenAI tool schemas. Dates are ISO `YYYY-MM-DD`; names are matched fuzzily server-side. */
export const CHAT_TOOLS: ChatTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_contact',
      description: 'Add a new person to the network when the user mentions someone not already tracked.',
      parameters: {
        type: 'object',
        properties: {
          name: str('Full name'),
          company: str('Company or organization'),
          role: str('Job title'),
          email: str('Email address'),
          phone: str('Phone number'),
          linkedinUrl: str('LinkedIn profile URL'),
          warmth: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Relationship temperature' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_goal',
      description: 'Create a goal the user is working toward (e.g. fundraising, hiring, finding a job).',
      parameters: { type: 'object', properties: { title: str('Short goal title') }, required: ['title'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_contact_to_goal',
      description: 'Attach an existing person to an existing goal.',
      parameters: {
        type: 'object',
        properties: { contactName: str('Person to attach'), goalTitle: str('Goal to attach them to') },
        required: ['contactName', 'goalTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_status',
      description: 'Move a person to a different pipeline status.',
      parameters: {
        type: 'object',
        properties: { contactName: str('Person'), status: { type: 'string', enum: STATUSES, description: 'New status' } },
        required: ['contactName', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_meeting',
      description: 'Record that the user met with someone. Optionally set a follow-up date.',
      parameters: {
        type: 'object',
        properties: { contactName: str('Person'), notes: str('What was discussed'), followUpDate: str('Follow-up date YYYY-MM-DD') },
        required: ['contactName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_response',
      description: 'Record that a person replied to the user.',
      parameters: {
        type: 'object',
        properties: { contactName: str('Person'), summary: str('Summary of their reply'), nextStep: str('Captured next step') },
        required: ['contactName', 'summary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_sent',
      description: 'Record that the user sent a message to someone (advances them to Pending).',
      parameters: { type: 'object', properties: { contactName: str('Person') }, required: ['contactName'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_follow_up',
      description: 'Set a follow-up reminder date for a person.',
      parameters: {
        type: 'object',
        properties: { contactName: str('Person'), date: str('Date YYYY-MM-DD'), reason: str('Why follow up') },
        required: ['contactName', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_meeting',
      description: 'Schedule a meeting with a person.',
      parameters: {
        type: 'object',
        properties: { contactName: str('Person'), date: str('Date YYYY-MM-DD'), time: str('Time HH:MM 24h'), notes: str('Agenda') },
        required: ['contactName', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_message',
      description: 'Draft an outreach message to a person in the user’s voice.',
      parameters: {
        type: 'object',
        properties: {
          contactName: str('Person'),
          kind: { type: 'string', enum: ['outreach', 'follow-up', 'reply', 'message'], description: 'Kind of message' },
          tone: str('Desired tone'),
        },
        required: ['contactName'],
      },
    },
  },
];

let counter = 0;
function newId(): string {
  counter += 1;
  return `act_${Date.now().toString(36)}_${counter}`;
}

/** Turn a model tool call into a typed ProposedAction. Returns null on bad JSON,
 *  unknown tool, or missing required fields. */
export function parseToolCall(name: string, argsJson: string): ProposedAction | null {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson || '{}');
  } catch {
    return null;
  }
  const s = (k: string): string | undefined => (typeof args[k] === 'string' && (args[k] as string).trim() ? (args[k] as string).trim() : undefined);
  const id = newId();

  switch (name) {
    case 'create_contact': {
      const nm = s('name');
      if (!nm) return null;
      const warmth = s('warmth');
      return { id, type: 'create_contact', args: { name: nm, company: s('company'), role: s('role'), email: s('email'), phone: s('phone'), linkedinUrl: s('linkedinUrl'), warmth: (warmth as Warmth) } };
    }
    case 'create_goal': {
      const title = s('title');
      return title ? { id, type: 'create_goal', args: { title } } : null;
    }
    case 'add_contact_to_goal': {
      const c = s('contactName'); const g = s('goalTitle');
      return c && g ? { id, type: 'add_contact_to_goal', args: { contactName: c, goalTitle: g } } : null;
    }
    case 'set_status': {
      const c = s('contactName'); const status = s('status');
      return c && status && (STATUSES as string[]).includes(status) ? { id, type: 'set_status', args: { contactName: c, status: status as Status } } : null;
    }
    case 'log_meeting': {
      const c = s('contactName');
      return c ? { id, type: 'log_meeting', args: { contactName: c, notes: s('notes'), followUpDate: s('followUpDate') } } : null;
    }
    case 'log_response': {
      const c = s('contactName'); const summary = s('summary');
      return c && summary ? { id, type: 'log_response', args: { contactName: c, summary, nextStep: s('nextStep') } } : null;
    }
    case 'mark_sent': {
      const c = s('contactName');
      return c ? { id, type: 'mark_sent', args: { contactName: c } } : null;
    }
    case 'set_follow_up': {
      const c = s('contactName'); const date = s('date');
      return c && date ? { id, type: 'set_follow_up', args: { contactName: c, date, reason: s('reason') } } : null;
    }
    case 'schedule_meeting': {
      const c = s('contactName'); const date = s('date');
      return c && date ? { id, type: 'schedule_meeting', args: { contactName: c, date, time: s('time'), notes: s('notes') } } : null;
    }
    case 'draft_message': {
      const c = s('contactName');
      return c ? { id, type: 'draft_message', args: { contactName: c, kind: s('kind'), tone: s('tone') } } : null;
    }
    default:
      return null;
  }
}

/** Human summary for the confirm card. */
export function describeAction(a: ProposedAction): string {
  switch (a.type) {
    case 'create_contact': return `Add ${a.args.name}${a.args.company ? ` at ${a.args.company}` : ''}${a.args.role ? ` (${a.args.role})` : ''}`;
    case 'create_goal': return `Create goal “${a.args.title}”`;
    case 'add_contact_to_goal': return `Add ${a.args.contactName} to goal “${a.args.goalTitle}”`;
    case 'set_status': return `Move ${a.args.contactName} → ${a.args.status}`;
    case 'log_meeting': return `Log meeting with ${a.args.contactName}${a.args.followUpDate ? ` · follow up ${a.args.followUpDate}` : ''}`;
    case 'log_response': return `Log reply from ${a.args.contactName}`;
    case 'mark_sent': return `Mark message sent to ${a.args.contactName}`;
    case 'set_follow_up': return `Follow up with ${a.args.contactName} on ${a.args.date}`;
    case 'schedule_meeting': return `Schedule meeting with ${a.args.contactName} on ${a.args.date}${a.args.time ? ` at ${a.args.time}` : ''}`;
    case 'draft_message': return `Draft a ${a.args.kind ?? 'message'} to ${a.args.contactName}`;
  }
}
