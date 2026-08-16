import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Position, Range } from 'vscode-languageserver-types';
import { offsetInStringOrComment } from '../analysis/skipRegions';
import type { RuleIssue } from './issueTypes';

function offsetToPosition(source: string, offset: number): Position {
  const lines = source.slice(0, offset).split('\n');
  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length,
  };
}

/** Same identifiers as `strictImplicitBoolIf` — those are already warned there when that rule is on. */
const STRICT_OVERLAP = new Set([
  'bar_index',
  'volume',
  'close',
  'open',
  'high',
  'low',
  'time',
]);

/**
 * Heuristic alignment with TradingView **CE10101** (*if/switch condition must be bool*):
 * a lone identifier after `if` on the same line (before `then`, `//`, or EOL) is often `series int/float`
 * or `na`-able float in v6 examples — TV rejects it; suggest `bool()`, comparisons, or `not na()`.
 *
 * **Not** a full type checker; false positives are possible (e.g. a variable that is already `bool`).
 * Runtime errors (RE*) and full CW* flow analysis are out of scope here.
 */
export function tradingViewUserManualIssues(
  source: string,
  options: { enabled: boolean; strictImplicitBoolIf: boolean; cap: number },
): RuleIssue[] {
  if (!options.enabled) return [];
  const re = /\bif\s+(?!not\b)(?!true\b)(?!false\b)([a-zA-Z_]\w*)\s*(?:$|\/\/|then\b)/g;
  const lines = source.split('\n');
  const out: RuleIssue[] = [];
  let lineOffset = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (out.length >= options.cap) return out;
      const ident = m[1];
      if (options.strictImplicitBoolIf && STRICT_OVERLAP.has(ident)) continue;

      const identStartInLine = m.index + m[0].indexOf(ident);
      const globalStart = lineOffset + identStartInLine;
      if (offsetInStringOrComment(source, globalStart)) continue;

      const identEnd = globalStart + ident.length;
      const range: Range = {
        start: offsetToPosition(source, globalStart),
        end: offsetToPosition(source, identEnd),
      };
      out.push({
        code: 'pine-forge/TV-CE10101',
        message:
          'TradingView CE10101 (Pine v6): if/switch conditions must be bool. If this identifier is not bool, use bool(), an explicit comparison, or not na() for na checks. See TradingView User Manual: Errors and warnings → CE10101.',
        range,
        severity: DiagnosticSeverity.Information,
      });
    }
    lineOffset += line.length + 1;
  }
  return out;
}
