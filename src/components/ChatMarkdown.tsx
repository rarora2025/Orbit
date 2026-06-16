import { Fragment } from 'react';
import { tokenizeInline, parseBlocks } from '@/lib/chat/markdown';

function Inline({ text }: { text: string }) {
  return (
    <>
      {tokenizeInline(text).map((t, i) => {
        if (t.type === 'bold') return <strong key={i} className="font-semibold text-stone-900">{t.value}</strong>;
        if (t.type === 'italic') return <em key={i}>{t.value}</em>;
        if (t.type === 'code') return <code key={i} className="px-1 py-0.5 rounded bg-stone-200/70 text-[12.5px] font-mono">{t.value}</code>;
        return <Fragment key={i}>{t.value}</Fragment>;
      })}
    </>
  );
}

/** Renders the assistant's light Markdown (bold/italic/code, bullet & numbered
 *  lists, paragraphs) so it never shows literal `**asterisks**`. */
export default function ChatMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.type === 'ul') {
          return (
            <ul key={i} className="list-disc pl-5 space-y-0.5">
              {b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
            </ul>
          );
        }
        if (b.type === 'ol') {
          return (
            <ol key={i} className="list-decimal pl-5 space-y-0.5">
              {b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
            </ol>
          );
        }
        return (
          <p key={i} className="leading-relaxed">
            {b.lines.map((line: string, j: number) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline text={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
