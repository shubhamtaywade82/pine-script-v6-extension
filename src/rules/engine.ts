import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Range } from 'vscode-languageserver-types';
import type { ParsedDocument } from '../parser/parser';
import type { PineV6Settings } from '../settings';

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
  settings: PineV6Settings,
): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // 1. Version Check
  if (settings.strictVersionCheck) {
    if (parsed.versionDirective === null) {
      issues.push({
        code: 'pine-v6/version-missing',
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
        code: 'pine-v6/version-below-6',
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
          code: 'pine-v6/unknown-call',
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
              code: 'pine-v6/deprecated-transp',
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
              code: 'pine-v6/deprecated-when',
              message: `The 'when' parameter is removed in Pine v6. Wrap the function call in an 'if' block instead.`,
              range: arg.range,
              severity: DiagnosticSeverity.Error,
            });
          }
        }
      }

      // v6 Migration: na() on bool
      if (node.name === 'na' || node.name === 'nz' || node.name === 'fixnan') {
        // This is a bit speculative as we don't have full type inference,
        // but we can check if the value looks like a boolean literal or variable
        const firstArg = node.args[0];
        if (firstArg && (firstArg.value === 'true' || firstArg.value === 'false')) {
          issues.push({
            code: 'pine-v6/bool-na',
            message: `Booleans can no longer be 'na' in Pine v6. 'na()', 'nz()', and 'fixnan()' no longer accept bool arguments.`,
            range: firstArg.range,
            severity: DiagnosticSeverity.Error,
          });
        }
      }
    }
  }

  const max = Math.max(1, settings.maxNumberOfProblems);
  return issues.slice(0, max);
}
