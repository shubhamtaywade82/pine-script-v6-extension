import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Range, Position } from 'vscode-languageserver-types';
import { offsetInStringOrComment } from '../analysis/skipRegions';
import type { ParsedDocument } from '../parser/parser';
import type { PineForgeSettings } from '../settings';
import { collectLimitationHints } from './limitationHints';
import { collectTradingViewStyleHints } from './styleTradingViewHints';

export function offsetToPosition(source: string, offset: number): Position {
  const lines = source.slice(0, offset).split('\n');
  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length,
  };
}

export interface RuleIssue {
  code: string;
  message: string;
  range: Range;
  severity: typeof DiagnosticSeverity.Error | typeof DiagnosticSeverity.Warning | typeof DiagnosticSeverity.Information;
}

const DEPRECATED_TRANSP = new Set([
  'plot',
  'plotshape',
  'plotchar',
  'plotcandle',
  'plotbar',
  'bgcolor',
  'fill',
  'hline',
]);

const STRATEGY_FUNCTIONS = new Set([
  'strategy.entry',
  'strategy.exit',
  'strategy.order',
  'strategy.close',
  'strategy.close_all',
  'strategy.cancel',
  'strategy.cancel_all',
]);

export function runRules(
  parsed: ParsedDocument,
  builtins: Set<string>,
  settings: PineForgeSettings,
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const source = parsed.source;

  // 1. Version Check
  if (settings.strictVersionCheck) {
    if (parsed.versionDirective === null) {
      issues.push({
        code: 'pine-forge/version-missing',
        message:
          'Declare a Pine version with //@version=6 at the top of the script (strict version check is enabled).',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        severity: DiagnosticSeverity.Warning,
      });
    } else if (parsed.versionDirective < 6) {
      issues.push({
        code: 'pine-forge/version-below-6',
        message: `Pine v6 tooling: found //@version=${parsed.versionDirective}. See migration: https://www.tradingview.com/pine-script-docs/migration-guides/to-pine-version-6/`,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        severity: DiagnosticSeverity.Information,
      });
    }
  }

  // 2. Node-based rules
  for (const node of parsed.nodes) {
    if (node.kind === 'call') {
      // Unknown call rule
      if (!builtins.has(node.name)) {
        issues.push({
          code: 'pine-forge/unknown-call',
          message: `Unknown or unsupported call '${node.name}' for the bundled reference index.`,
          range: node.range,
          severity: DiagnosticSeverity.Warning,
        });
      }

      // v6 Migration: transp parameter removal
      if (DEPRECATED_TRANSP.has(node.name)) {
        for (const arg of node.args) {
          if (arg.name === 'transp') {
            issues.push({
              code: 'pine-forge/deprecated-transp',
              message: `The 'transp' parameter is removed in Pine v6. Use 'color.new(color, transp)' instead.`,
              range: arg.range,
              severity: DiagnosticSeverity.Error,
            });
          }
        }
      }

      // v6 Migration: when parameter removal from strategy functions
      if (STRATEGY_FUNCTIONS.has(node.name)) {
        for (const arg of node.args) {
          if (arg.name === 'when') {
            issues.push({
              code: 'pine-forge/deprecated-when',
              message: `The 'when' parameter is removed in Pine v6. Wrap the function call in an 'if' block instead.`,
              range: arg.range,
              severity: DiagnosticSeverity.Error,
            });
          }
        }
      }

      // v6 Migration: na() on bool
      if (node.name === 'na' || node.name === 'nz' || node.name === 'fixnan') {
        const firstArg = node.args[0];
        if (firstArg && (firstArg.value === 'true' || firstArg.value === 'false')) {
          issues.push({
            code: 'pine-forge/bool-na',
            message: `Booleans can no longer be 'na' in Pine v6. 'na()', 'nz()', and 'fixnan()' no longer accept bool arguments.`,
            range: firstArg.range,
            severity: DiagnosticSeverity.Error,
          });
        }
      }
    }
  }

  // 3. Optional: bare `if series_id` on same line (conservative — opt-in for trust)
  if (settings.strictImplicitBoolIf) {
    const commonNonBoolVars = ['bar_index', 'volume', 'close', 'open', 'high', 'low', 'time'];
    for (const varName of commonNonBoolVars) {
      const ifRegex = new RegExp(`\\bif\\s+(${varName})\\b`, 'g');
      let match: RegExpExecArray | null;
      while ((match = ifRegex.exec(source)) !== null) {
        const varStart = match.index + match[0].indexOf(match[1]);
        const varEnd = varStart + match[1].length;
        if (offsetInStringOrComment(source, varStart)) continue;
        const tail = source.slice(varEnd);
        if (!/^\s*(?:$|\/\/|\n)/.test(tail)) continue;
        issues.push({
          code: 'pine-forge/implicit-bool-cast',
          message: `Implicit cast from '${varName}' to bool is not allowed in Pine v6. Use an explicit comparison (e.g. \`${varName} != na\`) or \`bool(${varName})\` where appropriate.`,
          range: {
            start: offsetToPosition(source, varStart),
            end: offsetToPosition(source, varEnd),
          },
          severity: DiagnosticSeverity.Warning,
        });
      }
    }
  }

  if (settings.styleTradingViewHints) {
    const styleCap = Math.max(1, Math.min(25, settings.maxNumberOfProblems));
    issues.push(...collectTradingViewStyleHints(source, styleCap));
  }

  if (settings.limitationHints) {
    const limCap = 3;
    issues.push(...collectLimitationHints(parsed, limCap));
  }

  return issues;
}
