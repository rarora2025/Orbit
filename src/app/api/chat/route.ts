import OpenAI from 'openai';
import { auth, currentUser } from '@clerk/nextjs/server';
import { listContacts } from '@/lib/contacts.actions';
import { listGoals } from '@/lib/goals.actions';
import { getProfileMemory } from '@/lib/chat/memory.actions';
import { buildNetworkSnapshot } from '@/lib/chat/networkContext';
import { buildSystemPrompt } from '@/lib/chat/prompt';
import { CHAT_TOOLS, parseToolCall, type ChatStreamEvent, type ProposedAction } from '@/lib/chat/tools';

const MODEL = 'gpt-4o';
const MAX_HISTORY = 20;

interface ClientMessage {
  role: 'user' | 'assistant';
  content: string;
}

function ndjsonStream(run: (emit: (e: ChatStreamEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: ChatStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
      try {
        await run(emit);
      } catch (err) {
        console.error('chat stream error', err);
        emit({ type: 'error', message: 'The assistant hit an error. Try again in a moment.' });
      } finally {
        emit({ type: 'done' });
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { messages?: ClientMessage[] };
  const history = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY);

  const apiKey = process.env.OPEN_AI_KEY;
  if (!apiKey) {
    return ndjsonStream(async (emit) => {
      emit({ type: 'text', delta: 'The AI assistant isn’t configured yet (no OpenAI key). Once it’s set up I can reason over your whole network and take actions for you.' });
    });
  }

  // Gather context in parallel; tolerate partial failures.
  const [contacts, goals, memory, user] = await Promise.all([
    listContacts().catch(() => []),
    listGoals().catch(() => []),
    getProfileMemory().catch(() => ''),
    currentUser().catch(() => null),
  ]);

  const system = buildSystemPrompt({
    snapshot: buildNetworkSnapshot(contacts, goals),
    memory,
    userName: user?.firstName ?? undefined,
    today: new Date().toISOString().slice(0, 10),
  });

  const openai = new OpenAI({ apiKey });

  return ndjsonStream(async (emit) => {
    const stream = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      stream: true,
      tools: CHAT_TOOLS,
      messages: [{ role: 'system', content: system }, ...history],
    });

    // Accumulate tool-call deltas by index (they arrive fragmented).
    const toolAcc: Record<number, { name: string; args: string }> = {};
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) emit({ type: 'text', delta: delta.content });
      for (const tc of delta.tool_calls ?? []) {
        const slot = (toolAcc[tc.index] ??= { name: '', args: '' });
        if (tc.function?.name) slot.name += tc.function.name;
        if (tc.function?.arguments) slot.args += tc.function.arguments;
      }
    }

    const proposals = Object.values(toolAcc)
      .map((t) => parseToolCall(t.name, t.args))
      .filter((p): p is ProposedAction => p !== null);
    if (proposals.length) emit({ type: 'proposals', proposals });
  });
}
