import type { Range } from 'vscode-languageserver-types';
import { positionToOffset } from '../analysis/wordRefs';
import type {
  Program,
  Statement,
  Expression,
  CallExpr,
} from '../ast';
import type { AstNode, ParsedDocument } from './parser';

function sliceByRange(source: string, r: Range): string {
  const a = positionToOffset(source, r.start);
  const b = positionToOffset(source, r.end);
  return source.slice(a, b);
}

/** Callee as a single reference key (`plot`, `ta.sma`, `request.security`). */
export function calleeDisplayName(callee: Expression): string | null {
  if (callee.type === 'Identifier') return callee.name;
  /** `na(...)` is tokenized as `NALiteral` followed by `(` — treat as the `na` built-in call. */
  if (callee.type === 'NALiteral') return 'na';
  if (callee.type === 'MemberExpr') {
    const left = calleeDisplayName(callee.object);
    return left ? `${left}.${callee.property}` : callee.property;
  }
  return null;
}

function callExprToNode(source: string, e: CallExpr): Extract<AstNode, { kind: 'call' }> | null {
  const name = calleeDisplayName(e.callee);
  if (name === null) return null;
  return {
    kind: 'call',
    name,
    range: e.callee.range,
    args: e.args.map((arg) => ({
      name: arg.name,
      value: sliceByRange(source, arg.value.range),
      range: arg.value.range,
    })),
  };
}

function walkExpression(
  source: string,
  e: Expression,
  out: Extract<AstNode, { kind: 'call' }>[] | null,
  onCall: ((c: CallExpr) => void) | null,
): void {
  switch (e.type) {
    case 'CallExpr': {
      onCall?.(e);
      if (out) {
        const node = callExprToNode(source, e);
        if (node) out.push(node);
      }
      for (const arg of e.args) walkExpression(source, arg.value, out, onCall);
      return;
    }
    case 'BinaryExpr':
      walkExpression(source, e.left, out, onCall);
      walkExpression(source, e.right, out, onCall);
      return;
    case 'UnaryExpr':
      walkExpression(source, e.operand, out, onCall);
      return;
    case 'TernaryExpr':
      walkExpression(source, e.condition, out, onCall);
      walkExpression(source, e.consequent, out, onCall);
      walkExpression(source, e.alternate, out, onCall);
      return;
    case 'IndexExpr':
      walkExpression(source, e.object, out, onCall);
      walkExpression(source, e.index, out, onCall);
      return;
    case 'MemberExpr':
      walkExpression(source, e.object, out, onCall);
      return;
    case 'TupleExpr':
      for (const el of e.elements) walkExpression(source, el, out, onCall);
      return;
    case 'LambdaExpr':
      for (const p of e.params) {
        if (p.defaultValue) walkExpression(source, p.defaultValue, out, onCall);
      }
      if (Array.isArray(e.body)) walkStatements(source, e.body, out, onCall);
      else walkExpression(source, e.body, out, onCall);
      return;
    default:
      return;
  }
}

function walkStatements(
  source: string,
  stmts: Statement[],
  out: Extract<AstNode, { kind: 'call' }>[] | null,
  onCall: ((c: CallExpr) => void) | null,
): void {
  for (const s of stmts) walkStatement(source, s, out, onCall);
}

function walkStatement(
  source: string,
  s: Statement,
  out: Extract<AstNode, { kind: 'call' }>[] | null,
  onCall: ((c: CallExpr) => void) | null,
): void {
  switch (s.type) {
    case 'VarDecl':
      if (s.init) walkExpression(source, s.init, out, onCall);
      return;
    case 'Assignment':
      walkExpression(source, s.target, out, onCall);
      walkExpression(source, s.value, out, onCall);
      return;
    case 'ExprStmt':
      walkExpression(source, s.expression, out, onCall);
      return;
    case 'IfStmt':
      walkExpression(source, s.condition, out, onCall);
      walkStatements(source, s.consequent, out, onCall);
      if (s.alternate) {
        if (Array.isArray(s.alternate)) walkStatements(source, s.alternate, out, onCall);
        else walkStatement(source, s.alternate, out, onCall);
      }
      return;
    case 'ForStmt':
      walkExpression(source, s.from, out, onCall);
      walkExpression(source, s.to, out, onCall);
      if (s.by) walkExpression(source, s.by, out, onCall);
      walkStatements(source, s.body, out, onCall);
      return;
    case 'WhileStmt':
      walkExpression(source, s.condition, out, onCall);
      walkStatements(source, s.body, out, onCall);
      return;
    case 'SwitchStmt':
      if (s.subject) walkExpression(source, s.subject, out, onCall);
      for (const c of s.cases) {
        walkExpression(source, c.value, out, onCall);
        walkStatements(source, c.body, out, onCall);
      }
      if (s.defaultBody) walkStatements(source, s.defaultBody, out, onCall);
      return;
    case 'ReturnStmt':
      if (s.value) walkExpression(source, s.value, out, onCall);
      return;
    case 'FunctionDecl':
      for (const p of s.params) {
        if (p.defaultValue) walkExpression(source, p.defaultValue, out, onCall);
      }
      walkStatements(source, s.body, out, onCall);
      return;
    case 'TypeDecl':
      for (const f of s.fields) {
        if (f.defaultValue) walkExpression(source, f.defaultValue, out, onCall);
      }
      return;
    case 'EnumDecl':
      for (const m of s.members) {
        if (m.value) walkExpression(source, m.value, out, onCall);
      }
      return;
    case 'ExportDecl':
      walkStatement(source, s.declaration, out, onCall);
      return;
    case 'ImportDecl':
    case 'BreakStmt':
    case 'ContinueStmt':
      return;
    default:
      return;
  }
}

/**
 * Builds the same shape as legacy `parseDocument` for rule engines, but call sites and
 * version come exclusively from {@link parseProgram}'s AST (single source of truth).
 */
/** Visit every `CallExpr` in the program (depth-first, including nested expressions). */
export function forEachCallExpr(program: Program, fn: (c: CallExpr) => void): void {
  walkStatements('', program.body, null, fn);
}

export function buildParsedDocumentFromProgram(source: string, program: Program): ParsedDocument {
  const calls: Extract<AstNode, { kind: 'call' }>[] = [];
  walkStatements(source, program.body, calls, null);
  const nodes: AstNode[] = [];
  if (program.version !== null && program.versionRange) {
    nodes.push({
      kind: 'version',
      major: program.version,
      range: program.versionRange,
    });
  }
  nodes.push(...calls);
  return {
    nodes,
    versionDirective: program.version,
    source,
  };
}
