import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Range } from 'vscode-languageserver-types';
import { positionToOffset } from '../analysis/wordRefs';
import type { Program, Statement, Expression } from '../ast';
import { calleeDisplayName, forEachCallExpr } from '../parser/parsedDocumentFromProgram';
import type { RuleIssue } from '../rules/issueTypes';

function sliceByRange(source: string, r: Range): string {
  const a = positionToOffset(source, r.start);
  const b = positionToOffset(source, r.end);
  return source.slice(a, b);
}

const OHLC_LIKE = new Set(['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4']);

function isNegativeHistoryIndex(expr: Expression): boolean {
  if (expr.type === 'NumberLiteral') return expr.value < 0 || expr.raw.trim().startsWith('-');
  if (expr.type === 'UnaryExpr' && expr.operator === '-' && expr.operand.type === 'NumberLiteral') {
    return expr.operand.value === 1 || expr.operand.raw === '1';
  }
  return false;
}

function indexObjectName(expr: Expression): string | null {
  if (expr.type === 'Identifier') return expr.name;
  return null;
}

function walkExprForRepaint(source: string, e: Expression, issues: RuleIssue[]): void {
  if (e.type === 'IndexExpr') {
    const name = indexObjectName(e.object);
    if (name && OHLC_LIKE.has(name) && isNegativeHistoryIndex(e.index)) {
      issues.push({
        code: 'pine-forge/repaint-negative-history',
        message:
          'Negative history reference reads future data on the current bar (repaint / lookahead risk). Prefer positive offsets or confirmed-bar logic.',
        range: e.range,
        severity: DiagnosticSeverity.Information,
      });
    }
    walkExprForRepaint(source, e.object, issues);
    walkExprForRepaint(source, e.index, issues);
    return;
  }
  if (e.type === 'CallExpr') {
    for (const a of e.args) walkExprForRepaint(source, a.value, issues);
    return;
  }
  if (e.type === 'BinaryExpr') {
    walkExprForRepaint(source, e.left, issues);
    walkExprForRepaint(source, e.right, issues);
    return;
  }
  if (e.type === 'UnaryExpr') {
    walkExprForRepaint(source, e.operand, issues);
    return;
  }
  if (e.type === 'TernaryExpr') {
    walkExprForRepaint(source, e.condition, issues);
    walkExprForRepaint(source, e.consequent, issues);
    walkExprForRepaint(source, e.alternate, issues);
    return;
  }
  if (e.type === 'MemberExpr') {
    walkExprForRepaint(source, e.object, issues);
    return;
  }
  if (e.type === 'TupleExpr') {
    for (const el of e.elements) walkExprForRepaint(source, el, issues);
    return;
  }
  if (e.type === 'LambdaExpr') {
    for (const p of e.params) {
      if (p.defaultValue) walkExprForRepaint(source, p.defaultValue, issues);
    }
    if (Array.isArray(e.body)) walkStmtsForRepaint(source, e.body, issues);
    else walkExprForRepaint(source, e.body, issues);
  }
}

function walkStmtsForRepaint(source: string, stmts: Statement[], issues: RuleIssue[]): void {
  for (const s of stmts) walkStmtForRepaint(source, s, issues);
}

function walkStmtForRepaint(source: string, s: Statement, issues: RuleIssue[]): void {
  switch (s.type) {
    case 'VarDecl':
      if (s.init) walkExprForRepaint(source, s.init, issues);
      return;
    case 'Assignment':
      walkExprForRepaint(source, s.target, issues);
      walkExprForRepaint(source, s.value, issues);
      return;
    case 'ExprStmt':
      walkExprForRepaint(source, s.expression, issues);
      return;
    case 'IfStmt':
      walkExprForRepaint(source, s.condition, issues);
      walkStmtsForRepaint(source, s.consequent, issues);
      if (s.alternate) {
        if (Array.isArray(s.alternate)) walkStmtsForRepaint(source, s.alternate, issues);
        else walkStmtForRepaint(source, s.alternate, issues);
      }
      return;
    case 'ForStmt':
      walkExprForRepaint(source, s.from, issues);
      walkExprForRepaint(source, s.to, issues);
      if (s.by) walkExprForRepaint(source, s.by, issues);
      walkStmtsForRepaint(source, s.body, issues);
      return;
    case 'WhileStmt':
      walkExprForRepaint(source, s.condition, issues);
      walkStmtsForRepaint(source, s.body, issues);
      return;
    case 'SwitchStmt':
      if (s.subject) walkExprForRepaint(source, s.subject, issues);
      for (const c of s.cases) {
        walkExprForRepaint(source, c.value, issues);
        walkStmtsForRepaint(source, c.body, issues);
      }
      if (s.defaultBody) walkStmtsForRepaint(source, s.defaultBody, issues);
      return;
    case 'ReturnStmt':
      if (s.value) walkExprForRepaint(source, s.value, issues);
      return;
    case 'FunctionDecl':
      for (const p of s.params) {
        if (p.defaultValue) walkExprForRepaint(source, p.defaultValue, issues);
      }
      walkStmtsForRepaint(source, s.body, issues);
      return;
    case 'TypeDecl':
      for (const f of s.fields) {
        if (f.defaultValue) walkExprForRepaint(source, f.defaultValue, issues);
      }
      return;
    case 'EnumDecl':
      for (const m of s.members) {
        if (m.value) walkExprForRepaint(source, m.value, issues);
      }
      return;
    case 'ExportDecl':
      walkStmtForRepaint(source, s.declaration, issues);
      return;
    default:
      return;
  }
}

export function collectRepaintDiagnostics(source: string, program: Program): RuleIssue[] {
  const issues: RuleIssue[] = [];

  forEachCallExpr(program, (call) => {
    const name = calleeDisplayName(call.callee);
    if (name !== 'request.security') return;
    const slice = sliceByRange(source, call.range);
    if (/lookahead\s*=\s*barmerge\.lookahead_on\b/.test(slice)) {
      issues.push({
        code: 'pine-forge/repaint-security-lookahead',
        message:
          'request.security with lookahead_on can republish historical values when the higher timeframe updates (repaint risk). Prefer lookahead_off or confirmed-bar patterns where appropriate.',
        range: call.range,
        severity: DiagnosticSeverity.Warning,
      });
    }
  });

  walkStmtsForRepaint(source, program.body, issues);

  return issues;
}
