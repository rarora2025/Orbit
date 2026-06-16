export type InlineToken = { type: 'text' | 'bold' | 'italic' | 'code'; value: string };

// Order matters: code first (so * inside code isn't parsed), then bold, then italic.
const INLINE = /(\*\*([^*]+?)\*\*)|(`([^`]+?)`)|(\*([^*]+?)\*)|(\b_([^_]+?)_\b)/g;

/**
 * Split a line of text into inline tokens for **bold**, *italic* / _italic_, and
 * `code`. Everything else is plain text. Intentionally tiny — just enough to make
 * the assistant's light Markdown render instead of showing literal asterisks.
 */
export function tokenizeInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ type: 'text', value: text.slice(last, i) });
    if (m[2] !== undefined) out.push({ type: 'bold', value: m[2] });
    else if (m[4] !== undefined) out.push({ type: 'code', value: m[4] });
    else if (m[6] !== undefined) out.push({ type: 'italic', value: m[6] });
    else if (m[8] !== undefined) out.push({ type: 'italic', value: m[8] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

export type Block =
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; lines: string[] };

/** Group lines into bullet/numbered lists and paragraphs. */
export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === 'ul') last.items.push(bullet[1]);
      else blocks.push({ type: 'ul', items: [bullet[1]] });
    } else if (numbered) {
      if (last?.type === 'ol') last.items.push(numbered[1]);
      else blocks.push({ type: 'ol', items: [numbered[1]] });
    } else if (line.trim() === '') {
      if (last?.type === 'p') blocks.push({ type: 'p', lines: [] }); // paragraph break sentinel
    } else {
      if (last?.type === 'p' && last.lines.length) last.lines.push(line);
      else blocks.push({ type: 'p', lines: [line] });
    }
  }
  return blocks.filter((b) => b.type !== 'p' || b.lines.length > 0);
}
