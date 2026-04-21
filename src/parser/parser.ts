import type { Range, Position } from 'vscode-languageserver-types';

export function offsetToPosition(source: string, offset: number): Position {
  const lines = source.slice(0, offset).split('\n');
  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length,
  };
}

export type AstNode =
  | { kind: 'call'; name: string; range: Range; args: CallArgument[] }
  | { kind: 'version'; major: number; range: Range };

export interface CallArgument {
  name: string | null; // null for positional args
  value: string;
  range: Range;
}

export interface ParsedDocument {
  nodes: AstNode[];
  versionDirective: number | null;
  source: string;
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

  // Version directive detection
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

  function skipWhitespace() {
    while (i < n) {
      const ch = source[i];
      if (/\s/.test(ch)) {
        i++;
      } else if (ch === '/' && source[i + 1] === '/') {
        i += 2;
        while (i < n && source[i] !== '\n') i++;
      } else if (ch === '/' && source[i + 1] === '*') {
        i += 2;
        while (i < n - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i = Math.min(i + 2, n);
      } else {
        break;
      }
    }
  }

  while (i < n) {
    const ch = source[i];

    // Skip comments and strings to avoid false positives
    if (ch === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
      skipWhitespace();
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
      
      const savedI = i;
      skipWhitespace();
      
      if (i < n && source[i] === '(' && !NOT_CALLS.has(name)) {
        const callStart = start;
        const callNameEnd = savedI;
        i++; // skip '('
        
        const args: CallArgument[] = [];
        while (i < n && source[i] !== ')') {
          skipWhitespace();
          if (i >= n || source[i] === ')') break;
          
          const argStart = i;
          let argName: string | null = null;
          
          // Check for named argument e.g. color=color.red
          const nameMatch = source.slice(i).match(/^([a-zA-Z_]\w*)\s*=/);
          if (nameMatch) {
            argName = nameMatch[1];
            i += nameMatch[0].length;
            skipWhitespace();
          }
          
          // Parse value (simplified: until next comma or closing paren, handling nested parens)
          const valueStart = i;
          let depth = 0;
          while (i < n) {
            const c = source[i];
            if (c === '(' || c === '[' || c === '{') depth++;
            else if (c === ')' || c === ']' || c === '}') {
              if (depth === 0) break;
              depth--;
            } else if (c === ',' && depth === 0) {
              break;
            } else if (c === '"' || c === "'") {
              const q = c;
              i++;
              while (i < n && source[i] !== q) {
                if (source[i] === '\\') i++;
                i++;
              }
            }
            i++;
          }
          const value = source.slice(valueStart, i).trim();
          args.push({
            name: argName,
            value,
            range: {
              start: offsetToPosition(source, argStart),
              end: offsetToPosition(source, i),
            },
          });
          
          skipWhitespace();
          if (source[i] === ',') {
            i++;
          }
        }
        if (source[i] === ')') i++;
        
        nodes.push({
          kind: 'call',
          name,
          range: {
            start: offsetToPosition(source, callStart),
            end: offsetToPosition(source, callNameEnd),
          },
          args,
        });
      } else {
        // Not a call, backtrack to after name
        i = savedI;
      }
      continue;
    }
    i++;
  }

  return { nodes, versionDirective, source };
}
