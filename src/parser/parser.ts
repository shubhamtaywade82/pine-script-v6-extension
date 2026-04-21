import type { Range } from 'vscode-languageserver-types';
import { offsetToPosition } from '../position';

export type AstNode =
  | { kind: 'call'; name: string; range: Range }
  | { kind: 'version'; major: number; range: Range };

export interface ParsedDocument {
  nodes: AstNode[];
  versionDirective: number | null;
}

const NOT_CALLS = new Set([
  'if',
  'else',
  'for',
  'while',
  'switch',
  'return',
  'break',
  'continue',
  'var',
  'varip',
  'export',
  'import',
  'type',
  'enum',
  'method',
  'and',
  'or',
  'not',
  'to',
  'by',
]);

export function parseDocument(source: string): ParsedDocument {
  const nodes: AstNode[] = [];
  let versionDirective: number | null = null;

  const versionRe = /\/\/@version\s*=\s*(\d+)/g;
  let vm: RegExpExecArray | null;
  while ((vm = versionRe.exec(source)) !== null) {
    const major = parseInt(vm[1], 10);
    if (!Number.isFinite(major)) continue;
    if (versionDirective === null) {
      versionDirective = major;
    }
    const start = vm.index;
    const end = start + vm[0].length;
    nodes.push({
      kind: 'version',
      major,
      range: {
        start: offsetToPosition(source, start),
        end: offsetToPosition(source, end),
      },
    });
  }

  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === '/' && source[i + 1] === '/') {
      i += 2;
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i = Math.min(i + 2, n);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < n) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      i++;
      while (i < n && /[\w.]/.test(source[i])) i++;
      const name = source.slice(start, i);
      let j = i;
      while (j < n && /\s/.test(source[j])) j++;
      if (j < n && source[j] === '(' && !NOT_CALLS.has(name)) {
        nodes.push({
          kind: 'call',
          name,
          range: {
            start: offsetToPosition(source, start),
            end: offsetToPosition(source, i),
          },
        });
      }
      i = j;
      continue;
    }
    i++;
  }

  return { nodes, versionDirective };
}
