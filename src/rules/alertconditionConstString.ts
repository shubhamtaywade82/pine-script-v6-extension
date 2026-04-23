import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { AstNode, CallArgument } from '../parser/parser';
import type { RuleIssue } from './engine';

function pickArg(args: CallArgument[], paramName: string, positionalIndex: number): CallArgument | undefined {
  const named = args.find((a) => a.name === paramName);
  if (named) return named;
  return args[positionalIndex];
}

/**
 * TradingView CE10123: `alertcondition` `title` and `message` must be **const string**, not
 * `series string` (e.g. from `+` with non-literals or `str.tostring` on series).
 *
 * We treat as const: a single string literal, multiline `"""` / `'''`, a bare identifier (may be
 * a const var — skipped false positives), or `literal + literal + …` only. Anything else is flagged.
 */
export function isConstStringExpressionForAlert(value: string): boolean {
  const s = value.trim();
  if (s === '') return false;

  if (/^"([^"\\]|\\.)*"$/.test(s)) return true;
  if (/^'([^'\\]|\\.)*'$/.test(s)) return true;
  if (s.length >= 6 && s.startsWith('"""') && s.endsWith('"""')) return true;
  if (s.length >= 6 && s.startsWith("'''") && s.endsWith("'''")) return true;

  if (/^[A-Za-z_]\w*$/.test(s)) return true;

  if (!s.includes('+')) return false;

  const parts = s
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 2) return false;

  const eachPartIsStringLiteral = (p: string): boolean =>
    /^"([^"\\]|\\.)*"$/.test(p) || /^'([^'\\]|\\.)*'$/.test(p);

  return parts.every(eachPartIsStringLiteral);
}

export function alertconditionConstStringIssues(node: Extract<AstNode, { kind: 'call' }>): RuleIssue[] {
  if (node.name !== 'alertcondition') return [];

  const out: RuleIssue[] = [];
  const titleArg = pickArg(node.args, 'title', 1);
  const messageArg = pickArg(node.args, 'message', 2);

  const tvRef = 'TradingView CE10123: `title` and `message` must be const string, not series string.';

  if (titleArg && !isConstStringExpressionForAlert(titleArg.value)) {
    out.push({
      code: 'pine-forge/alertcondition-title-not-const',
      message: `${tvRef} This \`title\` expression is not a const string (e.g. avoid \`+\` with series or \`str.tostring\` on data).`,
      range: titleArg.range,
      severity: DiagnosticSeverity.Error,
    });
  }

  if (messageArg && !isConstStringExpressionForAlert(messageArg.value)) {
    out.push({
      code: 'pine-forge/alertcondition-message-not-const',
      message: `${tvRef} This \`message\` expression is not a const string (e.g. \`call "operator +" (series string)\`).`,
      range: messageArg.range,
      severity: DiagnosticSeverity.Error,
    });
  }

  return out;
}
