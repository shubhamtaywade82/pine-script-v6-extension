import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Program, CallExpr } from '../ast';
import { calleeDisplayName, forEachCallExpr } from '../parser/parsedDocumentFromProgram';
import type { RuleIssue } from '../rules/issueTypes';
import type { PineForgeSettings } from '../settings';

const BOOL_NA_FUNCS = new Set(['na', 'nz', 'fixnan']);

/**
 * AST-backed semantic issues (bool/`na` v6 rule always).
 * With `semanticTypeHints`, reserve for additional non-critical type diagnostics later.
 */
export function collectSemanticIssues(program: Program, settings: PineForgeSettings): RuleIssue[] {
  const issues: RuleIssue[] = [];

  forEachCallExpr(program, (call: CallExpr) => {
    const name = calleeDisplayName(call.callee);
    if (!name || !BOOL_NA_FUNCS.has(name)) return;
    const first = call.args[0]?.value;
    if (!first || first.type !== 'BoolLiteral') return;
    issues.push({
      code: 'pine-forge/bool-na',
      message: `Booleans can no longer be 'na' in Pine v6. '${name}()' no longer accepts bool arguments.`,
      range: first.range,
      severity: DiagnosticSeverity.Error,
    });
  });

  issues.push(...optionalSemanticTypeHints(program, settings));

  return issues;
}

function optionalSemanticTypeHints(_program: Program, settings: PineForgeSettings): RuleIssue[] {
  if (!settings.semanticTypeHints) return [];
  return [];
}
