type ScanState = 'code' | 'line_comment' | 'block_comment' | 'string';

/**
 * True if `offset` (0-based character index) lies inside a line/block comment or string literal.
 */
export function offsetInStringOrComment(text: string, offset: number): boolean {
  if (offset < 0 || offset > text.length) return false;

  let state: ScanState = 'code';
  let stringQuote: '"' | "'" | null = null;

  for (let i = 0; i < text.length; i++) {
    if (i === offset && state !== 'code') return true;

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
    }
  }

  return false;
}
