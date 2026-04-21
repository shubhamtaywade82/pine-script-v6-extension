import type { Range } from 'vscode-languageserver-types';

/** Word at offset: identifier / dotted built-in style (`ta.sma`). */
export function wordRangeAtOffset(
  text: string,
  offset: number,
): { word: string; start: number; end: number } | null {
  if (offset < 0 || offset > text.length) return null;
  const isWordChar = (c: string) => /[\w.]/.test(c);
  let start = offset;
  if (start >= text.length) start = text.length - 1;
  if (start < 0) return null;
  if (!isWordChar(text[start])) return null;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && isWordChar(text[end])) end++;
  const word = text.slice(start, end);
  if (!word) return null;
  return { word, start, end };
}

function offsetToPosition(text: string, offset: number): { line: number; character: number } {
  const head = text.slice(0, offset);
  const lines = head.split('\n');
  return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

type ScanState = 'code' | 'line_comment' | 'block_comment' | 'string';

function isIdentBoundary(c: string | undefined): boolean {
  return c === undefined || !/[\w.]/.test(c);
}

/**
 * Ranges of whole identifier `name`, skipping strings and // /* comments.
 */
export function findIdentifierRanges(text: string, name: string): Range[] {
  const ranges: Range[] = [];
  if (!name || !/^[a-zA-Z_][\w.]*$/.test(name)) return ranges;

  let state: ScanState = 'code';
  let stringQuote: '"' | "'" | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1] ?? '';

    if (state === 'line_comment') {
      if (ch === '\n') state = 'code';
      continue;
    }
    if (state === 'block_comment') {
      if (ch === '*' && next === '/') {
        state = 'code';
        i++;
      }
      continue;
    }
    if (state === 'string') {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === stringQuote) {
        state = 'code';
        stringQuote = null;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      state = 'line_comment';
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      state = 'block_comment';
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      state = 'string';
      stringQuote = ch as '"' | "'";
      continue;
    }

    if (
      text.startsWith(name, i) &&
      isIdentBoundary(i > 0 ? text[i - 1] : undefined) &&
      isIdentBoundary(text[i + name.length])
    ) {
      const start = i;
      const end = start + name.length;
      ranges.push({
        start: offsetToPosition(text, start),
        end: offsetToPosition(text, end),
      });
      i = end - 1;
    }
  }

  return ranges;
}
