import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Range } from 'vscode-languageserver-types';
import type { RuleIssue } from './engine';

type Scan = 'code' | 'string';

const THEN = 'then';

function truncateLineAtTrailingComment(line: string): string {
  let state: Scan = 'code';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1] ?? '';
    if (state === 'string') {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) {
        state = 'code';
        quote = null;
      }
      continue;
    }
    if (ch === '/' && next === '/') return line.slice(0, i);
    if (ch === '"' || ch === "'") {
      state = 'string';
      quote = ch as '"' | "'";
      i++;
    }
  }
  return line;
}

function isIdentChar(ch: string): boolean {
  return /[0-9a-zA-Z_]/.test(ch);
}

function findWordOutsideStrings(line: string, word: string, from: number): number {
  let state: Scan = 'code';
  let quote: '"' | "'" | null = null;
  for (let i = from; i <= line.length - word.length; i++) {
    const ch = line[i];
    const next = line[i + 1] ?? '';
    if (state === 'string') {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) {
        state = 'code';
        quote = null;
      }
      continue;
    }
    if (ch === '/' && next === '/') break;
    if (ch === '"' || ch === "'") {
      state = 'string';
      quote = ch as '"' | "'";
      continue;
    }
    if (line.slice(i, i + word.length) !== word) continue;
    const before = i > 0 ? line[i - 1] : ' ';
    const after = line[i + word.length] ?? ' ';
    if (isIdentChar(before) || before === '_') continue;
    if (isIdentChar(after) || after === '_') continue;
    return i;
  }
  return -1;
}

function semicolonAtZeroDepthAfter(line: string, start: number): number {
  let depth = 0;
  let state: Scan = 'code';
  let quote: '"' | "'" | null = null;
  for (let i = start; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1] ?? '';
    if (state === 'string') {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) {
        state = 'code';
        quote = null;
      }
      continue;
    }
    if (ch === '/' && next === '/') break;
    if (ch === '"' || ch === "'") {
      state = 'string';
      quote = ch as '"' | "'";
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) return i;
  }
  return -1;
}

function lineHasLeadingIfOrElseBefore(line: string, thenIndex: number): boolean {
  const head = line.slice(0, thenIndex);
  const ifAt = findWordOutsideStrings(head, 'if', 0);
  const elseAt = findWordOutsideStrings(head, 'else', 0);
  if (ifAt >= 0) return true;
  if (elseAt >= 0) return true;
  return false;
}

/**
 * Pine allows only one statement after `then` on the same line; TradingView rejects extra
 * statements separated by `;` ("no viable alternative at character ';'"). This is a targeted
 * check — not full grammar parity with TradingView.
 */
export function syntaxSurfaceIssues(source: string): RuleIssue[] {
  const lines = source.split('\n');
  const out: RuleIssue[] = [];
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const raw = lines[lineIdx];
    const line = truncateLineAtTrailingComment(raw);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    let searchFrom = 0;
    while (searchFrom < line.length) {
      const thenIdx = findWordOutsideStrings(line, THEN, searchFrom);
      if (thenIdx < 0) break;
      if (!lineHasLeadingIfOrElseBefore(line, thenIdx)) {
        searchFrom = thenIdx + THEN.length;
        continue;
      }
      const semi = semicolonAtZeroDepthAfter(line, thenIdx + THEN.length);
      if (semi >= 0) {
        const range: Range = {
          start: { line: lineIdx, character: semi },
          end: { line: lineIdx, character: semi + 1 },
        };
        out.push({
          code: 'pine-forge/invalid-then-semicolon',
          message:
            "Pine allows only one statement after `then` on the same line. Split into an indented block under `if` / `else`, or use separate lines. TradingView reports this as: no viable alternative at character ';'.",
          range,
          severity: DiagnosticSeverity.Error,
        });
        break;
      }
      searchFrom = thenIdx + THEN.length;
    }
  }
  return out;
}
