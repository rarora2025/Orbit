/**
 * Incremental newline-delimited-JSON parser for reading the chat stream. Feed it
 * decoded chunks; it buffers partial lines across chunk boundaries and returns
 * the JSON objects completed so far. Call `flush()` at end-of-stream for any
 * trailing line. Malformed lines are skipped rather than throwing.
 */
export function createNdjsonParser() {
  let buffer = '';

  function parse(line: string, out: unknown[]) {
    const t = line.trim();
    if (!t) return;
    try {
      out.push(JSON.parse(t));
    } catch {
      /* skip a malformed line */
    }
  }

  return {
    push(chunk: string): unknown[] {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      const out: unknown[] = [];
      for (const line of lines) parse(line, out);
      return out;
    },
    flush(): unknown[] {
      const out: unknown[] = [];
      parse(buffer, out);
      buffer = '';
      return out;
    },
  };
}
