import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Range } from 'vscode-languageserver-types';
import type { ParsedDocument } from '../parser/parser';

export interface RuleIssue {
  code: string;
  message: string;
  range: Range;
  severity: typeof DiagnosticSeverity.Error | typeof DiagnosticSeverity.Warning | typeof DiagnosticSeverity.Information;
}

export function runRules(
  parsed: ParsedDocument,
  builtins: Set<string>,
): RuleIssue[] {
  const issues: RuleIssue[] = [];

  if (parsed.versionDirective === null) {
    issues.push({
      code: 'pineforge/version-missing',
      message:
        'Declare a Pine version with //@version=6 at the top of the script (recommended for v6 tooling).',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      severity: DiagnosticSeverity.Warning,
    });
  } else if (parsed.versionDirective < 6) {
    issues.push({
      code: 'pineforge/version-below-6',
      message: `This workspace targets Pine v6; found //@version=${parsed.versionDirective}. See TradingView migration: https://www.tradingview.com/pine-script-docs/migration-guides/to-pine-version-6/`,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      severity: DiagnosticSeverity.Information,
    });
  }

  for (const node of parsed.nodes) {
    if (node.kind !== 'call') continue;
    if (builtins.has(node.name)) continue;
    issues.push({
      code: 'pineforge/unknown-call',
      message: `Unknown or unsupported call '${node.name}' for this extension's built-in index (expand references/pine.json or fix the name).`,
      range: node.range,
      severity: DiagnosticSeverity.Warning,
    });
  }

  return issues;
}
