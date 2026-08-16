import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Range } from 'vscode-languageserver-types';

export interface RuleIssue {
  code: string;
  message: string;
  range: Range;
  severity: typeof DiagnosticSeverity.Error | typeof DiagnosticSeverity.Warning | typeof DiagnosticSeverity.Information;
}
