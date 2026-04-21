import type { Range } from 'vscode-languageserver-types';
import type { Range as SrcRange } from '../ast';
import type { Expression, Program, Statement } from '../ast';
import { tokenize, TokenType, type Token } from '../lexer';
import { parseProgram } from './treeParser';

/** Named-argument snapshot for migration rules (token path has no args). */
export interface ParsedCallArg {
  name: string | null;
  /** Best-effort text for literals/identifiers; empty for complex expressions. */
  value: string;
  range: Range;
}

export type AstNode =
  | { kind: 'call'; name: string; range: Range; args: ParsedCallArg[] }
  | { kind: 'version'; major: number; range: Range };

export interface ParsedDocument {
  nodes: AstNode[];
  versionDirective: number | null;
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

function toLspRange(r: SrcRange): Range {
  return {
    start: { line: r.start.line, character: r.start.character },
    end: { line: r.end.line, character: r.end.character },
  };
}

function formatCallee(expr: Expression): string | null {
  if (expr.type === 'Identifier') return expr.name;
  if (expr.type === 'MemberExpr') {
    const base = formatCallee(expr.object);
    if (base) return `${base}.${expr.property}`;
    return expr.property;
  }
  return null;
}

function expressionSnapshotText(expr: Expression): string {
  switch (expr.type) {
    case 'Identifier':
      return expr.name;
    case 'BoolLiteral':
      return expr.value ? 'true' : 'false';
    case 'NumberLiteral':
      return expr.raw;
    case 'StringLiteral':
      return expr.value;
    case 'NALiteral':
      return 'na';
    case 'ColorLiteral':
      return expr.value;
    default:
      return '';
  }
}

function walkExpression(expr: Expression, nodes: AstNode[]): void {
  switch (expr.type) {
    case 'CallExpr': {
      const name = formatCallee(expr.callee);
      if (name && !NOT_CALLS.has(name)) {
        const args: ParsedCallArg[] = expr.args.map((a) => ({
          name: a.name,
          value: expressionSnapshotText(a.value),
          range: toLspRange(a.range),
        }));
        nodes.push({ kind: 'call', name, range: toLspRange(expr.range), args });
      }
      for (const arg of expr.args) {
        walkExpression(arg.value, nodes);
      }
      walkExpression(expr.callee, nodes);
      break;
    }
    case 'BinaryExpr':
      walkExpression(expr.left, nodes);
      walkExpression(expr.right, nodes);
      break;
    case 'UnaryExpr':
      walkExpression(expr.operand, nodes);
      break;
    case 'TernaryExpr':
      walkExpression(expr.condition, nodes);
      walkExpression(expr.consequent, nodes);
      walkExpression(expr.alternate, nodes);
      break;
    case 'IndexExpr':
      walkExpression(expr.object, nodes);
      walkExpression(expr.index, nodes);
      break;
    case 'MemberExpr':
      walkExpression(expr.object, nodes);
      break;
    case 'TupleExpr':
      for (const el of expr.elements) walkExpression(el, nodes);
      break;
    default:
      break;
  }
}

function walkStatement(stmt: Statement, nodes: AstNode[]): void {
  switch (stmt.type) {
    case 'ExprStmt':
      walkExpression(stmt.expression, nodes);
      break;
    case 'VarDecl':
      if (stmt.init) walkExpression(stmt.init, nodes);
      break;
    case 'Assignment':
      walkExpression(stmt.target, nodes);
      walkExpression(stmt.value, nodes);
      break;
    case 'FunctionDecl':
      for (const b of stmt.body) walkStatement(b, nodes);
      break;
    case 'IfStmt':
      walkExpression(stmt.condition, nodes);
      for (const b of stmt.consequent) walkStatement(b, nodes);
      if (stmt.alternate) {
        if (Array.isArray(stmt.alternate)) {
          for (const b of stmt.alternate) walkStatement(b, nodes);
        } else {
          walkStatement(stmt.alternate as Statement, nodes);
        }
      }
      break;
    case 'ForStmt':
      walkExpression(stmt.from, nodes);
      walkExpression(stmt.to, nodes);
      if (stmt.by) walkExpression(stmt.by, nodes);
      for (const b of stmt.body) walkStatement(b, nodes);
      break;
    case 'WhileStmt':
      walkExpression(stmt.condition, nodes);
      for (const b of stmt.body) walkStatement(b, nodes);
      break;
    case 'SwitchStmt':
      if (stmt.subject) walkExpression(stmt.subject, nodes);
      for (const c of stmt.cases) {
        walkExpression(c.value, nodes);
        for (const b of c.body) walkStatement(b, nodes);
      }
      if (stmt.defaultBody) {
        for (const b of stmt.defaultBody) walkStatement(b, nodes);
      }
      break;
    case 'ReturnStmt':
      if (stmt.value) walkExpression(stmt.value, nodes);
      break;
    default:
      break;
  }
}

function programToParsedDocument(program: Program): ParsedDocument {
  const nodes: AstNode[] = [];
  if (program.version !== null && program.versionRange) {
    nodes.push({
      kind: 'version',
      major: program.version,
      range: toLspRange(program.versionRange),
    });
  }
  for (const st of program.body) {
    walkStatement(st, nodes);
  }
  return { nodes, versionDirective: program.version };
}

function nextMeaningful(tokens: Token[], from: number): number {
  let j = from;
  while (j < tokens.length) {
    const t = tokens[j].type;
    if (
      t === TokenType.NEWLINE ||
      t === TokenType.INDENT ||
      t === TokenType.DEDENT ||
      t === TokenType.EOF
    ) {
      j++;
      continue;
    }
    return j;
  }
  return tokens.length;
}

function parseDocumentFromTokens(source: string): ParsedDocument {
  const nodes: AstNode[] = [];
  let versionDirective: number | null = null;
  const tokens = tokenize(source);

  for (const t of tokens) {
    if (t.type !== TokenType.ANNOTATION) continue;
    const m = t.value.match(/\/\/\s*@version\s*=\s*(\d+)/i);
    if (!m) continue;
    const major = parseInt(m[1], 10);
    if (!Number.isFinite(major)) continue;
    if (versionDirective !== null) break;
    versionDirective = major;
    nodes.push({
      kind: 'version',
      major,
      range: toLspRange(t.range),
    });
    break;
  }

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== TokenType.IDENT) continue;
    const name = tokens[i].value;
    if (NOT_CALLS.has(name)) continue;
    const j = nextMeaningful(tokens, i + 1);
    if (j < tokens.length && tokens[j].type === TokenType.LPAREN) {
      nodes.push({
        kind: 'call',
        name,
        range: toLspRange(tokens[i].range),
        args: [],
      });
    }
  }

  return { nodes, versionDirective };
}

export function parseDocument(source: string): ParsedDocument {
  try {
    const { program } = parseProgram(source);
    return programToParsedDocument(program);
  } catch {
    return parseDocumentFromTokens(source);
  }
}
