export type HighlightPart = { text: string; hit: boolean };

function foldToIndexMap(content: string): { folded: string; offsets: number[] } {
  const folded: string[] = [];
  const offsets: number[] = [];
  let utf16Offset = 0;
  for (const ch of content) {
    const stripped = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const base = stripped.length > 0 ? stripped[0]! : ch;
    folded.push(base.toLowerCase());
    offsets.push(utf16Offset);
    utf16Offset += ch.length;
  }
  return { folded: folded.join(""), offsets };
}

export function highlightParts(content: string, query: string): HighlightPart[] {
  const { folded, offsets } = foldToIndexMap(content);
  const tokens = foldedQuery(query);
  if (tokens.length === 0) return [{ text: content, hit: false }];

  const ranges: Array<{ start: number; end: number }> = [];
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(token, from);
      if (at < 0) break;
      const start = offsets[at];
      const endChar = offsets[Math.min(at + token.length, offsets.length)] ?? content.length;
      ranges.push({ start, end: endChar });
      from = at + 1;
    }
  }
  if (ranges.length === 0) return [{ text: content, hit: false }];

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const { start, end } of merged) {
    if (cursor < start) parts.push({ text: content.slice(cursor, start), hit: false });
    parts.push({ text: content.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < content.length) parts.push({ text: content.slice(cursor), hit: false });
  return parts;
}

function foldedQuery(query: string): string[] {
  const folded = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return folded
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}
